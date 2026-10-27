const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync(__dirname+'/../index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function app(initial={},options={}) {
 const data=new Map(Object.entries(initial).map(([k,v])=>[k,JSON.stringify(v)]));
 const elements=new Map(),intervals=[],events={};
 const el=id=>{if(!elements.has(id))elements.set(id,{dataset:{},textContent:'',innerHTML:'',hidden:false});return elements.get(id)};
 const context=vm.createContext({console,Date,Math,JSON,Set,URL,
  localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(options.failWrites)throw Error('quota');data.set(k,v)},removeItem:k=>data.delete(k)},
  document:{documentElement:{dataset:{}},visibilityState:'visible',getElementById:el,querySelector:()=>null,addEventListener:()=>{}},
  navigator:{onLine:false},location:{hostname:'localhost',protocol:'http:'},
  window:{scrollTo:()=>{}},addEventListener:(event,fn)=>{events[event]=fn},setInterval:(fn,ms)=>intervals.push({fn,ms})});
 vm.runInContext(script,context);
 return {run:s=>vm.runInContext(s,context),data,el,intervals,events,saved:k=>{const bundle=JSON.parse(data.get('cam-state')||'null');return bundle?bundle.values[k]:JSON.parse(data.get(k)||'null')}};
}
test('new installs use a single-page quick form; explicit detailed preference persists',()=>{
 const a=app();assert.equal(a.run('quick()'),true);
 assert.equal(a.el('next').textContent,'Save visit');assert.equal(a.el('back').hidden,true);
 assert.match(a.run('quickForm()'),/Batteries/);assert.doesNotMatch(a.run('quickForm()'),/Coming out|Pictures|Delay found/);
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
 const r=a.saved('cam-queue')[0];assert.equal(r.test,true);assert.equal(r.type,'Test');assert.equal(r.st.test,true);
});
test('test upload stays queued if the server does not support isolation',async()=>{
 const a=app({'cam-testing':true});a.run("S.site='Lion Pool';queue=[row()];cfg={url:'https://example.test',key:''};navigator.onLine=true;var requests=[];fetch=async(u,o)=>{requests.push(JSON.parse(o.body));return{text:async()=>JSON.stringify({ok:false})}};");
 await a.run('push()');assert.equal(a.run('queue.length'),1);assert.equal(a.run('requests.length'),1);assert.equal(a.run('requests[0].action'),'capabilities');
});
test('quick service records preserve actions while leaving unmeasured numeric fields blank',()=>{
 const a=app();
 a.run("Object.assign(S,{site:'Lion Pool',state:'Running',batteriesChanged:true,cardChanged:true,settingsChanged:true,trimmed:true,moved:true,photosTaken:true,lensCleaned:true,armed:true,locked:true,extra:'Mount checked',pics:'900',gb:'3',out:[12,0,0,0,0],inMode:'1.8',newCard:'64'});");
 const r=a.run('row()');assert.equal(r.onArrival,'');
 for(const key of ['pics','gbUsed','cardOut','span','out18','out17','out16','out15','outDead','battIn','cardIn','nextWeeks'])assert.equal(r[key],'',key);
 for(const text of ['Batteries changed','Card changed','Cleaned lens','Settings changed','Trimmed vegetation','Photos taken','Armed','Locked','Mount checked'])assert.ok(r.notes.includes(text),text);
 assert.equal(r.st.formMode,'quick');assert.equal(a.run('missing().length'),0);
});
test('streamlined photo checkbox appears only for trimming',()=>{
 const a=app();assert.doesNotMatch(a.run('quickForm()'),/Took photos/);
 a.run('S.trimmed=true');assert.match(a.run('quickForm()'),/Took photos/);
 assert.ok(a.run('missing().includes("trim photo")'));
 a.run('S.trimmed=false;S.moved=true');assert.doesNotMatch(a.run('quickForm()'),/Took photos/);
 a.run('S.moved=false;S.photosTaken=true');assert.doesNotMatch(a.run('quickForm()'),/Took photos/);
 assert.doesNotMatch(a.run('notesText()'),/Photos taken/);
});
test('quick visits queue offline and retain their mode when reopened for editing',()=>{
 const a=app();a.run("Object.assign(S,{site:'Lion Pool',batteriesChanged:true,cardChanged:true,armed:true,locked:true});saveVisit({dataset:{}})");
 const q=a.saved('cam-queue');assert.equal(q.length,1);assert.equal(q[0].st.formMode,'quick');
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
 const a=app();assert.equal(a.el('appVersion').textContent,'Version v25');assert.equal(a.el('updateBanner').hidden,true);
 a.run("navigator.onLine=true;fetch=async()=>({ok:true,json:async()=>({v:'v26'})})");await a.run('checkUpdate()');
 assert.equal(a.el('updateBanner').hidden,false);assert.equal(a.el('updateVersions').textContent,'This phone: v25 · Available: v26');assert.equal(a.el('updateApp').textContent,'Update now');
 a.run("fetch=async()=>({ok:true,json:async()=>({v:'v25'})})");await a.run('checkUpdate()');assert.equal(a.el('updateBanner').hidden,true);
});
test('cached older or malformed versions do not prompt; a failed check does not erase a known update',async()=>{
 const a=app();a.run('navigator.onLine=true');
 for(const v of ['v16','v25','garbage','v25-beta']){a.run(`fetch=async()=>({ok:true,json:async()=>({v:${JSON.stringify(v)}})})`);await a.run('checkUpdate()');assert.equal(a.el('updateBanner').hidden,true)}
 a.run("fetch=async()=>({ok:true,json:async()=>({v:'v26'})})");await a.run('checkUpdate()');
 a.run("fetch=async()=>{throw Error('offline')}");await a.run('checkUpdate()');assert.equal(a.el('updateBanner').hidden,false);assert.equal(a.run('checkingUpdate'),false);
});
test('update preserves unsaved draft, waiting visits and connection before a cache-busting navigation',()=>{
 const a=app({'cam-queue':[{id:'waiting',test:true,st:{test:true}}],'cam-cfg':{url:'https://example.test',key:'test-only'}});
 a.run("navigator.onLine=true;availableVersion='v26';S.site='Lion Pool';S.obs='Unsaved notes';var navigated='';location.href='https://example.test/cameras/';location.replace=u=>{navigated=u};applyUpdate()");
 assert.equal(a.saved('cam-visit').obs,'Unsaved notes');assert.equal(a.saved('cam-queue')[0].id,'waiting');assert.equal(a.saved('cam-cfg').key,'test-only');
 const url=new URL(a.run('navigated'));assert.equal(url.pathname,'/cameras/');assert.match(url.searchParams.get('app-update'),/^v26-/);
});
test('offline or failed local saving prevents updating away from the current visit',()=>{
 const a=app();a.run("availableVersion='v26';var navigated='';location.replace=u=>{navigated=u};applyUpdate()");assert.equal(a.run('navigated'),'');assert.equal(a.el('updateApp').disabled,true);assert.equal(a.el('updateApp').textContent,'Connect to update');
 a.run("navigator.onLine=true;localStorage.setItem=()=>{throw Error('full')};applyUpdate()");assert.equal(a.run('navigated'),'');assert.match(a.el('updateMessage').textContent,/Update paused/);
});
test('updates are checked each visible minute and when connectivity returns',async()=>{
 const a=app();a.run('navigator.onLine=true;var checks=0;fetch=async()=>{checks++;return{ok:true,json:async()=>({v:"v25"})}}');
 await a.intervals.find(x=>x.ms===60000).fn();assert.equal(a.run('checks'),1);
 await a.run('Promise.resolve()');a.run('document.visibilityState="hidden"');await a.intervals.find(x=>x.ms===60000).fn();assert.equal(a.run('checks'),1);
 await a.run('Promise.resolve()');a.events.online();assert.equal(a.run('checks'),2);
});

test('legacy phone records and settings migrate together to one durable snapshot',()=>{
 const a=app({'cam-queue':[{id:'legacy',test:false,st:{}}],'cam-cfg':{url:'https://example.test',key:'local-only'},'cam-testing':true});
 const envelope=JSON.parse(a.data.get('cam-state'));assert.equal(envelope.schema,1);assert.equal(envelope.values['cam-queue'][0].id,'legacy');assert.equal(envelope.values['cam-cfg'].key,'local-only');assert.equal(JSON.parse(a.data.get('cam-queue'))[0].id,'legacy');
 const b=app({'cam-state':envelope,'cam-queue':[{id:'stale'}]});assert.equal(b.run('queue[0].id'),'legacy');assert.equal(b.run('testing'),true);
});
test('failed local storage keeps the full draft and old queue instead of claiming a saved visit',()=>{
 const a=app();a.run("Object.assign(S,{site:'Lion Pool',extra:'keep these notes',batteriesChanged:true,cardChanged:true,armed:true,locked:true});save();var originalSet=localStorage.setItem;localStorage.setItem=()=>{throw Error('quota')}");
 const before=a.data.get('cam-state');a.run('saveVisit({dataset:{}})');assert.equal(a.run('S.site'),'Lion Pool');assert.equal(a.run('queue.length'),0);assert.equal(a.data.get('cam-state'),before);assert.equal(a.el('storageBanner').hidden,false);
 a.run('localStorage.setItem=originalSet;saveVisit({dataset:{}})');assert.equal(a.saved('cam-queue').length,1);assert.match(a.saved('cam-queue')[0].notes,/keep these notes/);assert.equal(a.saved('cam-visit').site,'');assert.equal(a.el('storageBanner').hidden,true);
});
test('unknown saved-state formats are not overwritten with a blank app',()=>{
 const original={schema:99,values:{'cam-visit':{site:'Keep me'}}};const a=app({'cam-state':original});assert.deepEqual(JSON.parse(a.data.get('cam-state')),original);assert.equal(a.el('storageBanner').hidden,false);
});
test('an edit made during upload is immediately retried and not called uploaded early',async()=>{
 const a=app();a.run("Object.assign(S,{site:'Lion Pool',batteriesChanged:true,cardChanged:true,armed:true,locked:true,extra:'original'});var first=row();queue=[first];S={...first.st,editId:first.id};cfg={url:'https://example.test',key:'dummy'};navigator.onLine=true;var posts=[],responses=[];fetch=async(u,o)=>{posts.push(JSON.parse(o.body));return new Promise(resolve=>responses.push(resolve))}");
 const uploading=a.run('push()');a.run("S.extra='edited while uploading';saveVisit({dataset:{}})");a.run('responses[0]({text:async()=>JSON.stringify({ok:true,saved:[first.id]})})');await uploading;await new Promise(setImmediate);
 assert.equal(a.run('posts.length'),2);assert.equal(a.run('queue.length'),1);assert.doesNotMatch(a.el('syncMsg').textContent,/^Uploaded to/);
 a.run('responses[1]({text:async()=>JSON.stringify({ok:true,saved:[first.id]})})');await new Promise(setImmediate);assert.equal(a.run('queue.length'),0);assert.match(a.saved('cam-sent')[0].notes,/edited while uploading/);
});
test('unsupported test uploads do not block real records or retry forever',async()=>{
 const a=app();a.run("Object.assign(S,{site:'Lion Pool',batteriesChanged:true,cardChanged:true,armed:true,locked:true});testing=true;var practice=row();testing=false;var real=row();queue=[practice,real];cfg={url:'https://example.test',key:'dummy'};navigator.onLine=true;var posts=[];fetch=async(u,o)=>{var body=JSON.parse(o.body);posts.push(body);return{text:async()=>JSON.stringify(body.action?{ok:false}:{ok:true,saved:[real.id]})}}");await a.run('push()');await new Promise(setImmediate);
 assert.equal(a.run('posts.length'),2);assert.equal(a.run('queue.length'),1);assert.equal(a.run('queue[0].test'),true);assert.equal(a.run('sent.length'),1);assert.match(a.el('syncMsg').textContent,/testing-mode update/);
});
test('failed upload keeps edited visits queued and does not start an endless retry',async()=>{
 const a=app();a.run("Object.assign(S,{site:'Lion Pool',batteriesChanged:true,cardChanged:true,armed:true,locked:true});var first=row();queue=[first];S={...first.st,editId:first.id};cfg={url:'https://example.test',key:'dummy'};navigator.onLine=true;var calls=0,rejectUpload;fetch=async()=>{calls++;return new Promise((resolve,reject)=>rejectUpload=reject)}");const pending=a.run('push()');a.run("S.extra='latest edit';saveVisit({dataset:{}});rejectUpload(Error('network down'))");await pending;await new Promise(setImmediate);assert.equal(a.run('calls'),1);assert.equal(a.run('queue.length'),1);assert.match(a.saved('cam-queue')[0].notes,/latest edit/);assert.equal(a.el('syncPill').textContent,'Upload failed');
});

test('failed first migration preserves legacy phone data until a complete snapshot fits',()=>{
 const legacy={'cam-queue':[{id:'legacy-safe',test:false,st:{}}],'cam-visit':{...app().run('blank()'),site:'Lion Pool',extra:'old draft'},'cam-cfg':{url:'https://example.test',key:'local-only'}};const options={failWrites:true};const a=app(legacy,options);
 assert.equal(a.data.has('cam-state'),false);assert.deepEqual(JSON.parse(a.data.get('cam-queue')),legacy['cam-queue']);assert.equal(a.run('S.extra'),'old draft');assert.equal(a.el('storageBanner').hidden,false);
 options.failWrites=false;assert.equal(a.run('save()'),true);assert.equal(a.saved('cam-queue')[0].id,'legacy-safe');assert.equal(a.saved('cam-visit').extra,'old draft');
});

test('a lost upload receipt leaves the same visit ID queued for safe retry',async()=>{
 const a=app();a.run("Object.assign(S,{site:'Lion Pool',batteriesChanged:true,cardChanged:true,armed:true,locked:true});queue=[row()];cfg={url:'https://example.test',key:'dummy'};save();var originalId=queue[0].id;navigator.onLine=true;var calls=0;fetch=async()=>{calls++;return{text:async()=>JSON.stringify({ok:true,saved:[originalId]})}};localStorage.setItem=()=>{throw Error('quota')}");await a.run('push()');assert.equal(a.run('queue.length'),1);assert.equal(a.saved('cam-queue')[0].id,a.run('originalId'));assert.equal(a.el('storageBanner').hidden,false);assert.match(a.el('syncMsg').textContent,/receipt could not be saved/);assert.equal(a.run('calls'),1);
});
