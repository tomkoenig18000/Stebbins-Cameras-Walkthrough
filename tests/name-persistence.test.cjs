const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync(__dirname+'/../index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];

function app(initial={}){
 const data=new Map(Object.entries(initial).map(([key,value])=>[key,JSON.stringify(value)]));
 const elements=new Map(),events={};
 const element=id=>{
  if(!elements.has(id))elements.set(id,{id,dataset:{},textContent:'',innerHTML:'',hidden:false,focus(){},setAttribute(){}});
  return elements.get(id);
 };
 const context=vm.createContext({console,Date,Math,JSON,Set,URL,
  localStorage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)},
  document:{documentElement:{dataset:{}},visibilityState:'visible',activeElement:null,getElementById:element,
   querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(name,fn)=>(events[name]??=[]).push(fn)},
  navigator:{onLine:false},location:{hostname:'localhost',protocol:'http:'},
  window:{scrollTo(){}},addEventListener(){},setInterval(){}});
 vm.runInContext(script,context);
 vm.runInContext("document.getElementById('next').onclick()",context);
 return {run:source=>vm.runInContext(source,context),data,element,
  input:target=>(events.input||[]).forEach(fn=>fn({target})),
  click:button=>(events.click||[]).forEach(fn=>fn({target:{closest:()=>button}})),
  saved:key=>JSON.parse(data.get('cam-state')).values[key]};
}
const nameInput=value=>({id:'preferredName',tagName:'INPUT',type:'text',value});

test('failed phone storage cannot partially persist a changed name and its current draft',()=>{
 const a=app({'cam-serviced-by':'Original Name'});
 const previous=a.data.get('cam-state');
 a.run("var originalWrite=localStorage.setItem;localStorage.setItem=()=>{throw Error('storage full')}");
 a.input(nameInput('Replacement Name'));
 assert.equal(a.data.get('cam-state'),previous);
 assert.equal(a.saved('cam-serviced-by'),'Original Name');
 assert.equal(a.saved('cam-visit').servicedBy,'Original Name');
 assert.equal(a.element('storageBanner').hidden,false);
 a.run('localStorage.setItem=originalWrite;save()');
 assert.equal(a.saved('cam-serviced-by'),'Replacement Name');
 assert.equal(a.saved('cam-visit').servicedBy,'Replacement Name');
 assert.equal(a.element('storageBanner').hidden,true);
});

test('changing phone default during a historical edit leaves that visit and its stashed draft attributed correctly',()=>{
 const seed=app().run('blank()');
 Object.assign(seed,{site:'Lion Pool',servicedBy:'Original Field Worker',formMode:'quick',batteriesChanged:true,cardChanged:true,armed:true,locked:true});
 const a=app({'cam-serviced-by':'Phone Owner','cam-sent':[{id:'past-visit',date:seed.date,site:seed.site,test:false,line:'Old summary',st:seed}]});
 a.run("S.site='Big Pool';S.servicedBy='Draft Field Worker'");
 a.click({dataset:{open:'past-visit'}});
 a.input(nameInput('New Phone Owner'));
 assert.equal(a.run('S.servicedBy'),'Original Field Worker');
 assert.equal(a.saved('cam-serviced-by'),'New Phone Owner');
 a.run("saveVisit(document.getElementById('next'))");
 assert.equal(a.saved('cam-queue')[0].servicedBy,'Original Field Worker');
 assert.equal(a.run('S.site'),'Big Pool');
 assert.equal(a.run('S.servicedBy'),'Draft Field Worker');
 assert.equal(a.run('blank().servicedBy'),'New Phone Owner');
});

test('correcting a historical visit name does not change the phone default or existing saved record before save',()=>{
 const seed=app().run('blank()');
 Object.assign(seed,{site:'Lion Pool',servicedBy:'Misspelled Person',formMode:'quick'});
 const a=app({'cam-serviced-by':'Phone Owner','cam-sent':[{id:'past-visit',date:seed.date,site:seed.site,test:false,line:'Old summary',st:seed}]});
 a.click({dataset:{open:'past-visit'}});
 a.input({dataset:{f:'servicedBy'},tagName:'INPUT',type:'text',value:'Corrected Person'});
 assert.equal(a.saved('cam-serviced-by'),'Phone Owner');
 assert.equal(a.saved('cam-sent')[0].st.servicedBy,'Misspelled Person');
 assert.equal(a.run('row().servicedBy'),'Corrected Person');
 assert.match(a.run('row().notes'),/Serviced by: Corrected Person/);
});

test('legacy quick reposition and photo notes survive edits without reviving the removed control or warning',()=>{
 const seed=app().run('blank()');
 Object.assign(seed,{site:'Lion Pool',formMode:'quick',moved:true,photosTaken:true,batteriesChanged:true,cardChanged:true,armed:true,locked:true});
 const a=app({'cam-sent':[{id:'legacy-reposition',date:seed.date,site:seed.site,test:false,line:'Lion Pool: Repositioned. Photos taken',st:seed}]});
 a.click({dataset:{open:'legacy-reposition'}});
 assert.match(a.run('row().notes'),/Repositioned/);
 assert.match(a.run('row().notes'),/Photos taken/);
 assert.doesNotMatch(a.run('quickForm()'),/data-f="moved"|data-f="photosTaken"/);
 a.run('S.photosTaken=false');
 assert.equal(a.run('missingDetails().length'),0,'a removed reposition step does not require photos');
 a.run("S.photosTaken=true;S.extra='Corrected note';saveVisit(document.getElementById('next'))");
 assert.match(a.saved('cam-queue')[0].notes,/Repositioned/);
 assert.match(a.saved('cam-queue')[0].notes,/Photos taken/);
 assert.match(a.saved('cam-queue')[0].notes,/Corrected note/);
});
