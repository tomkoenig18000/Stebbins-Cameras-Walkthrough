const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync(__dirname+'/../index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function app(initial={}) {
 const data=new Map(Object.entries(initial).map(([k,v])=>[k,JSON.stringify(v)]));
 const elements=new Map(),intervals=[],events={};
 const el=id=>{if(!elements.has(id))elements.set(id,{dataset:{},textContent:'',innerHTML:'',hidden:false});return elements.get(id)};
 const context=vm.createContext({console,Date,Math,JSON,Set,URL,
  localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},
  document:{documentElement:{dataset:{}},visibilityState:'visible',getElementById:el,querySelector:()=>null,addEventListener:()=>{}},
  navigator:{onLine:false},location:{hostname:'localhost',protocol:'http:'},
  window:{scrollTo:()=>{}},addEventListener:(event,fn)=>{events[event]=fn},setInterval:(fn,ms)=>intervals.push({fn,ms})});
 vm.runInContext(script,context);
 return {run:s=>vm.runInContext(s,context),data,el,intervals,events};
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

test('version is visible and a newer release shows installed and available versions',async()=>{
 const a=app();assert.equal(a.el('appVersion').textContent,'Version v17');assert.equal(a.el('updateBanner').hidden,true);
 a.run("navigator.onLine=true;fetch=async()=>({ok:true,json:async()=>({v:'v18'})})");await a.run('checkUpdate()');
 assert.equal(a.el('updateBanner').hidden,false);assert.equal(a.el('updateVersions').textContent,'This phone: v17 · Available: v18');assert.equal(a.el('updateApp').textContent,'Update now');
 a.run("fetch=async()=>({ok:true,json:async()=>({v:'v17'})})");await a.run('checkUpdate()');assert.equal(a.el('updateBanner').hidden,true);
});
test('cached older or malformed versions do not prompt; a failed check does not erase a known update',async()=>{
 const a=app();a.run('navigator.onLine=true');
 for(const v of ['v16','v17','garbage','v17-beta']){a.run(`fetch=async()=>({ok:true,json:async()=>({v:${JSON.stringify(v)}})})`);await a.run('checkUpdate()');assert.equal(a.el('updateBanner').hidden,true)}
 a.run("fetch=async()=>({ok:true,json:async()=>({v:'v18'})})");await a.run('checkUpdate()');
 a.run("fetch=async()=>{throw Error('offline')}");await a.run('checkUpdate()');assert.equal(a.el('updateBanner').hidden,false);assert.equal(a.run('checkingUpdate'),false);
});
test('update preserves unsaved draft, waiting visits and connection before a cache-busting navigation',()=>{
 const a=app({'cam-queue':[{id:'waiting',test:true,st:{test:true}}],'cam-cfg':{url:'https://example.test',key:'test-only'}});
 a.run("navigator.onLine=true;availableVersion='v18';S.site='Lion Pool';S.obs='Unsaved notes';var navigated='';location.href='https://example.test/cameras/';location.replace=u=>{navigated=u};applyUpdate()");
 assert.equal(JSON.parse(a.data.get('cam-visit')).obs,'Unsaved notes');assert.equal(JSON.parse(a.data.get('cam-queue'))[0].id,'waiting');assert.equal(JSON.parse(a.data.get('cam-cfg')).key,'test-only');
 const url=new URL(a.run('navigated'));assert.equal(url.pathname,'/cameras/');assert.match(url.searchParams.get('app-update'),/^v18-/);
});
test('offline or failed local saving prevents updating away from the current visit',()=>{
 const a=app();a.run("availableVersion='v18';var navigated='';location.replace=u=>{navigated=u};applyUpdate()");assert.equal(a.run('navigated'),'');assert.equal(a.el('updateApp').disabled,true);assert.equal(a.el('updateApp').textContent,'Connect to update');
 a.run("navigator.onLine=true;localStorage.setItem=()=>{throw Error('full')};applyUpdate()");assert.equal(a.run('navigated'),'');assert.match(a.el('updateMessage').textContent,/Update paused/);
});
test('updates are checked each visible minute and when connectivity returns',async()=>{
 const a=app();a.run('navigator.onLine=true;var checks=0;fetch=async()=>{checks++;return{ok:true,json:async()=>({v:"v17"})}}');
 await a.intervals.find(x=>x.ms===60000).fn();assert.equal(a.run('checks'),1);
 await a.run('Promise.resolve()');a.run('document.visibilityState="hidden"');await a.intervals.find(x=>x.ms===60000).fn();assert.equal(a.run('checks'),1);
 await a.run('Promise.resolve()');a.events.online();assert.equal(a.run('checks'),2);
});
