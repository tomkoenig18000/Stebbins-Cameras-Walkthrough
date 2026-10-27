const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync(__dirname+'/../index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];

function app(){
 const elements=new Map(),events={},windowEvents={},data=new Map();let viewWrites=0;
 const el=id=>{if(!elements.has(id)){
  let html='';const node={id,dataset:{},textContent:'',hidden:false,focus(){},setAttribute(){}};
  Object.defineProperty(node,'innerHTML',{get:()=>html,set:v=>{html=v;if(id==='view')viewWrites++}});
  elements.set(id,node);
 }return elements.get(id)};
 const document={documentElement:{dataset:{}},visibilityState:'visible',getElementById:el,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(name,fn)=>{events[name]=fn}};
 const context=vm.createContext({console,Date,Math,JSON,Set,URL,document,
  localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},
  navigator:{onLine:false},location:{hostname:'localhost',protocol:'http:'},
  window:{scrollTo(){}},addEventListener:(name,fn)=>{windowEvents[name]=fn},setInterval(){}});
 vm.runInContext(script,context);
 const run=s=>vm.runInContext(s,context);
 return {run,el,document,windowEvents,views:()=>viewWrites,
  input:target=>events.input({target}),change:target=>events.change({target}),
  click:button=>events.click({target:{closest:()=>button}})};
}

test('native select commits once on change without replacing its open input event',()=>{
 const a=app(),target={tagName:'SELECT',type:'select-one',dataset:{f:'site'},value:'Lion Pool'};
 const before=a.views();a.input(target);
 assert.equal(a.views(),before);assert.equal(a.run('S.site'),'');
 a.change(target);assert.equal(a.run('S.site'),'Lion Pool');assert.equal(a.views(),before+1);
});

test('date commits on change; file input is left to its dedicated import handler',()=>{
 const a=app();a.run("S.date='2026-10-26'");
 const target={tagName:'INPUT',type:'date',dataset:{f:'date'},value:'2026-10-27'};
 const before=a.views();a.input(target);assert.equal(a.run('S.date'),'2026-10-26');assert.equal(a.views(),before);
 a.change(target);assert.equal(a.run('S.date'),'2026-10-27');assert.equal(a.views(),before+1);
 a.input({tagName:'INPUT',type:'file',id:'imp',dataset:{}});assert.equal(a.views(),before+1);
});

test('rerender does not refocus a dismissed native picker, while ordinary control focus survives',()=>{
 for(const [tagName,type] of [['SELECT','select-one'],['INPUT','date'],['INPUT','file'],['INPUT','checkbox']]){
  const a=app();let focused=0;
  a.document.activeElement={id:'chosen',tagName,type,isConnected:false,dataset:{}};
  a.document.querySelectorAll=()=>[{id:'chosen',dataset:{},focus:()=>focused++}];a.run('render()');
  assert.equal(focused,type==='checkbox'?1:0,tagName+' '+type);
 }
});

test('discard takes exactly two immediate taps and edits invalidate the first tap',()=>{
 const a=app();a.run("S.site='Lion Pool';S.extra='keep me'");
 const discard={id:'discard',dataset:{},textContent:'Discard visit'};
 a.click(discard);assert.equal(discard.textContent,'Tap again to discard');assert.equal(a.run('S.site'),'Lion Pool');
 a.click(discard);assert.equal(a.run('S.site'),'');
 a.run("S.site='Lion Pool'");a.click(discard);
 a.input({tagName:'INPUT',type:'text',dataset:{f:'extra'},value:'changed draft'});
 a.click(discard);assert.equal(a.run('S.extra'),'changed draft');
 a.click(discard);assert.equal(a.run('S.site'),'');
});

test('save-anyway is immediate but a changed draft must be confirmed again',()=>{
 const a=app();a.run("S.site='Lion Pool'");
 const save={id:'next',dataset:{},textContent:'Save visit'};
 a.run('saveVisit(document.getElementById("next"))');assert.equal(a.run('queue.length'),0);
 a.input({tagName:'INPUT',type:'text',dataset:{f:'extra'},value:'new notes'});
 a.run('saveVisit(document.getElementById("next"))');assert.equal(a.run('queue.length'),0);
 a.run('saveVisit(document.getElementById("next"))');assert.equal(a.run('queue.length'),1);
 assert.match(a.run('queue[0].notes'),/new notes/);
});

test('connectivity and upload completion keep the active form and discard confirmation intact',async()=>{
 const a=app();a.run("Object.assign(S,{site:'Lion Pool',extra:'editing'});queue=[row()];cfg={url:'https://example.test',key:'dummy'};navigator.onLine=true;fetch=async()=>({text:async()=>JSON.stringify({ok:true})});discardConfirmation=confirmationKey()");
 const before=a.views();await a.run('push()');assert.equal(a.views(),before);assert.equal(a.run('discardLabel()'),'Tap again to discard');
 a.windowEvents.offline();assert.equal(a.views(),before);assert.equal(a.run('discardLabel()'),'Tap again to discard');
});


test('foreground date refresh updates the visible date and saved draft together without replacing the form',()=>{
 const a=app(),dateInput={value:'2026-10-26'};
 a.document.querySelector=selector=>selector==='[data-f="date"]'?dateInput:null;
 a.run("S.date='2026-10-26'");const before=a.views();a.run('freshDate()');
 assert.equal(dateInput.value,a.run('S.date'));
 assert.equal(dateInput.value,a.run('today()'));
 assert.equal(a.views(),before);
});
