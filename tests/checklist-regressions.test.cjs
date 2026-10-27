const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const script=fs.readFileSync(__dirname+'/../index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function app(initial={}) {
 const data=new Map(Object.entries(initial).map(([key,value])=>[key,JSON.stringify(value)]));
 const elements=new Map(),handlers={};
 const el=id=>{
  if(!elements.has(id))elements.set(id,{id,dataset:{},textContent:'',innerHTML:'',hidden:false,attributes:{},
   setAttribute(key,value){this.attributes[key]=value},removeAttribute(key){delete this.attributes[key]},
   focus(){},scrollIntoView(){}});
  return elements.get(id);
 };
 const context=vm.createContext({console,Date,Math,JSON,Set,URL,
  localStorage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)},
  document:{documentElement:{dataset:{}},visibilityState:'visible',activeElement:null,getElementById:el,
   querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(name,fn)=>(handlers[name]??=[]).push(fn)},
  navigator:{onLine:false},location:{hostname:'localhost',protocol:'http:'},window:{scrollTo(){}},
  addEventListener(){},setInterval(){}});
 vm.runInContext(script,context);
 return {run:source=>vm.runInContext(source,context),el,
  input:target=>(handlers.input||[]).forEach(fn=>fn({target})),
  click:button=>(handlers.click||[]).forEach(fn=>fn({target:{closest:()=>button}})),
  saved:key=>JSON.parse(data.get('cam-state')).values[key]};
}
const complete=`Object.assign(S,{site:'Lion Pool',servicedBy:'Eli McKay',batteriesChanged:true,cardChanged:true,armed:true,locked:true,out:[12,0,0,0,0],inMode:'1.8',pics:'123',last:'2026-10-27',newCard:'64'})`;
const critical=[['batteriesChanged','Batteries'],['cardChanged','Card'],['armed','Armed'],['locked','Locked']];

for(const mode of ['quick','detailed'])for(const [field,label] of critical){
 test(`${mode}: unchecked ${label} warns even when all measurements are complete`,()=>{
  const a=app();a.run(`${complete};S.formMode=${JSON.stringify(mode)};S.${field}=false`);
  assert.deepEqual([...a.run('criticalMissing()')],[label]);
  assert.equal(a.run('missingDetails().length'),0);
  assert.deepEqual([...a.run('missing()')],[label]);
  assert.match(a.run('readinessWarnings()'),new RegExp(label));
  a.run('saveVisit(document.getElementById("next"))');
  assert.equal(a.run('queue.length'),0,'first tap must request confirmation');
  a.run('saveVisit(document.getElementById("next"))');
  assert.equal(a.run('queue.length'),1,'immediate second tap explicitly saves anyway');
 });
}

for(const mode of ['quick','detailed']){
 test(`${mode}: checklist warnings precede less urgent missing details`,()=>{
  const a=app();a.run(`S.site='Lion Pool';S.formMode=${JSON.stringify(mode)};S.servicedBy='';S.trimmed=true`);
  const primary=[...a.run('criticalMissing()')],secondary=[...a.run('missingDetails()')];
  assert.deepEqual(primary,['Batteries','Card','Armed','Locked']);
  assert.ok(secondary.length,'missing trim photo supplies a secondary warning in either mode');
  assert.deepEqual([...a.run('missing()')].slice(0,4),primary);
  const html=a.run('readinessWarnings()');
  assert.match(html,/role="alert"/);
  for(const label of primary)assert.ok(html.includes(label),label);
  assert.ok(html.indexOf('Batteries')<html.indexOf(secondary[0]),'critical warning appears before detail warning');
  a.run('S.batteriesChanged=S.cardChanged=S.armed=S.locked=true');
  assert.equal(a.run('criticalMissing().length'),0);
  assert.ok(a.run('missingDetails().length')>0,'completion does not conceal missing details');
 });
}

test('changing a visit invalidates a pending save-anyway confirmation',()=>{
 const a=app();a.run(`${complete};S.locked=false;saveVisit(document.getElementById('next'))`);
 assert.equal(a.run('queue.length'),0);
 a.input({dataset:{f:'extra'},tagName:'TEXTAREA',type:'textarea',value:'Gate was stuck'});
 a.run('saveVisit(document.getElementById("next"))');
 assert.equal(a.run('queue.length'),0,'a changed visit needs a fresh confirmation');
 a.run('saveVisit(document.getElementById("next"))');
 assert.equal(a.run('queue.length'),1);
 assert.match(a.saved('cam-queue')[0].notes,/Gate was stuck/);
});

test('discard uses exactly two immediate taps, returns Home, and leaves saved visits unchanged',()=>{
 const a=app();a.run("S.site='Lion Pool';S.extra='unsaved draft'");
 const button={id:'discard',dataset:{},textContent:'Discard visit'};
 a.click(button);assert.equal(a.run('S.site'),'Lion Pool');assert.match(button.textContent,/again/i);
 a.click(button);assert.equal(a.run('S.site'),'');assert.equal(a.run('S.extra'),'');
 assert.equal(a.run('days'),true);assert.equal(a.run('homeTab'),'visits');assert.match(a.run("document.getElementById('view').innerHTML"),/<h2>Home<\/h2>/);assert.equal(a.run('flash'),'');
 assert.equal(a.run('queue.length'),0);
});

test('the service name persists on this phone and is copied to each new visit',()=>{
 const a=app();
 a.input({dataset:{f:'servicedBy'},tagName:'INPUT',type:'text',value:'Olivia de Silva'});
 assert.equal(a.saved('cam-serviced-by'),'Olivia de Silva');
 a.run(`${complete};S.servicedBy='Olivia de Silva';saveVisit(document.getElementById('next'))`);
 assert.equal(a.saved('cam-queue')[0].st.servicedBy,'Olivia de Silva');
 assert.equal(a.run('S.servicedBy'),'Olivia de Silva');
 const b=app({'cam-state':{schema:1,values:{'cam-serviced-by':'Olivia de Silva'}}});
 assert.equal(b.run('S.servicedBy'),'Olivia de Silva');
 b.run('S.date="2026-11-02";S=blank()');
 assert.equal(b.run('S.servicedBy'),'Olivia de Silva','phone preference persists beyond a single day');
});

test('a service name remains optional and does not warn when the checklist is complete',()=>{
 const a=app();a.run(`${complete};S.servicedBy=''`);
 assert.equal(a.run('missing().length'),0);
});

for(const mode of ['quick','detailed']){
 test(`${mode}: uploader notes and copied summaries preserve the service name's capitalization`,()=>{
  const a=app();a.run(`${complete};S.formMode=${JSON.stringify(mode)};S.servicedBy='Olivia de Silva'`);
  assert.match(a.run('row().notes'),/Serviced by: Olivia de Silva/);
  assert.match(a.run('line()'),/Serviced by: Olivia de Silva/);
  assert.doesNotMatch(a.run('notesText()'),/Serviced by:/,'attribution is appended once by record/summary creation');
  assert.equal((a.run('row().notes').match(/Serviced by:/g)||[]).length,1);
  assert.equal((a.run('line()').match(/Serviced by:/g)||[]).length,1);
 });
}

test('editing an old visit does not invent the current phone owner as its service person',()=>{
 const seed=app().run('blank()');delete seed.servicedBy;
 seed.site='Lion Pool';seed.formMode='quick';
 const a=app({'cam-serviced-by':'Current Phone Owner','cam-sent':[{id:'old-no-name',test:false,date:'2026-09-02',site:'Lion Pool',line:'Lion Pool: historic visit',st:seed}]});
 a.click({dataset:{open:'old-no-name'}});
 assert.equal(a.run('S.editId'),'old-no-name');
 assert.equal(a.run('S.servicedBy'),'');
 assert.doesNotMatch(a.run('row().notes'),/Current Phone Owner/);
 assert.equal(a.saved('cam-serviced-by'),'Current Phone Owner');
});
