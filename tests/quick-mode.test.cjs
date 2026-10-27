const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync(__dirname+'/../index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function app(initial={}) {
 const data=new Map(Object.entries(initial).map(([k,v])=>[k,JSON.stringify(v)]));
 const elements=new Map();
 const el=id=>{if(!elements.has(id))elements.set(id,{dataset:{},textContent:'',innerHTML:'',hidden:false});return elements.get(id)};
 const context=vm.createContext({console,Date,Math,JSON,Set,URL,
  localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},
  document:{documentElement:{dataset:{}},getElementById:el,querySelector:()=>null,addEventListener:()=>{}},
  navigator:{onLine:false},location:{hostname:'localhost',protocol:'http:'},
  window:{scrollTo:()=>{}},addEventListener:()=>{},setInterval:()=>{}});
 vm.runInContext(script,context);
 return {run:s=>vm.runInContext(s,context),data,el};
}
test('new installs use a single-page quick form; explicit detailed preference persists',()=>{
 const a=app();assert.equal(a.run('quick()'),true);
 assert.equal(a.el('next').textContent,'Save visit');assert.equal(a.el('back').hidden,true);
 assert.match(a.run('quickForm()'),/Batteries changed/);assert.doesNotMatch(a.run('quickForm()'),/Coming out|Pictures|Delay found/);
 assert.equal(app({'cam-streamlined':false}).run('quick()'),false);
});
test('testing mode marks records, drafts and summaries and survives editing with the toggle off',()=>{
 const a=app({'cam-testing':true});a.run("S.site='Lion Pool';S.state='Running'");
 const r=a.run('row()');assert.equal(r.test,true);assert.equal(r.type,'Test');assert.match(r.notes,/^\[TEST\]/);assert.match(r.line,/^\[TEST\]/);assert.equal(r.st.test,true);
 const b=app({'cam-testing':false,'cam-visit':{...r.st,editId:r.id}});assert.equal(b.run('row().test'),true);
 assert.equal(app().run('row().test'),false);
});
test('old app queues are classified as tests before any retry',()=>{
 const a=app({'cam-queue':[{id:'legacy',date:'2026-10-11',site:"Annie's Junction",type:'Service',notes:'',line:'old visit',st:{}}]});
 const r=JSON.parse(a.data.get('cam-queue'))[0];assert.equal(r.test,true);assert.equal(r.type,'Test');assert.equal(r.st.test,true);
});
test('test upload stays queued if the server does not support isolation',async()=>{
 const a=app({'cam-testing':true});a.run("S.site='Lion Pool';queue=[row()];cfg={url:'https://example.test',key:''};navigator.onLine=true;var requests=[];fetch=async(u,o)=>{requests.push(JSON.parse(o.body));return{text:async()=>JSON.stringify({ok:false})}};");
 await a.run('push()');assert.equal(a.run('queue.length'),1);assert.equal(a.run('requests.length'),1);assert.equal(a.run('requests[0].action'),'capabilities');
});
test('quick service records preserve actions while leaving unmeasured numeric fields blank',()=>{
 const a=app();
 a.run("Object.assign(S,{site:'Lion Pool',state:'Running',batteriesChanged:true,cardChanged:true,settingsChanged:true,trimmed:true,moved:true,photosTaken:true,armed:true,locked:true,extra:'Mount checked',pics:'900',gb:'3',out:[12,0,0,0,0],inMode:'1.8',newCard:'64'});");
 const r=a.run('row()');assert.equal(r.onArrival,'OK');
 for(const key of ['pics','gbUsed','cardOut','span','out18','out17','out16','out15','outDead','battIn','cardIn','nextWeeks'])assert.equal(r[key],'',key);
 for(const text of ['Batteries changed','Card changed','Settings changed','Trimmed vegetation','Repositioned','Photos taken','Armed','Locked','Mount checked'])assert.ok(r.notes.includes(text),text);
 assert.equal(r.st.formMode,'quick');assert.equal(a.run('missing().length'),0);
});
test('photo checkbox appears only for trimming or repositioning',()=>{
 const a=app();assert.doesNotMatch(a.run('quickForm()'),/Took photos/);
 a.run('S.trimmed=true');assert.match(a.run('quickForm()'),/Took photos/);
 assert.ok(a.run('missing().includes("photos")'));
 a.run('S.trimmed=false;S.moved=true');assert.match(a.run('quickForm()'),/Took photos/);
 a.run('S.moved=false;S.photosTaken=true');assert.doesNotMatch(a.run('quickForm()'),/Took photos/);
 assert.doesNotMatch(a.run('notesText()'),/Photos taken/);
});
test('quick visits queue offline and retain their mode when reopened for editing',()=>{
 const a=app();a.run("Object.assign(S,{site:'Lion Pool',state:'Running',armed:true,locked:true});saveVisit({dataset:{}})");
 const q=JSON.parse(a.data.get('cam-queue'));assert.equal(q.length,1);assert.equal(q[0].st.formMode,'quick');
 assert.equal(a.run('S.site'),'');assert.equal(a.el('next').textContent,'Save visit');
 const b=app({'cam-streamlined':false,'cam-visit':{...q[0].st,editId:q[0].id}});
 assert.equal(b.run('quick()'),true);assert.equal(b.run('row().id'),q[0].id);assert.equal(b.run('row().update'),true);
});
test('pre-update detailed drafts keep their measurements and walkthrough',()=>{
 const seed=app().run('blank()');seed.site='Lion Pool';seed.pics='123';seed.out=[12,0,0,0,0];seed.inMode='1.8';
 const a=app({'cam-visit':seed});assert.equal(a.run('quick()'),false);
 assert.equal(a.run('row().pics'),'123');assert.equal(a.run('row().out18'),12);
 assert.equal(a.run('row().st.formMode'),'detailed');
});
