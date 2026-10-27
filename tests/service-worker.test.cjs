const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function worker(){
 const events={},requests=[],state={};
 class Request {constructor(input,options={}){Object.assign(this,typeof input==='string'?{url:new URL(input,'https://example.test/cameras/').href}:input,options)}}
 const ctx={URL,Request,location:{origin:'https://example.test'},self:{addEventListener:(name,fn)=>events[name]=fn,skipWaiting:()=>{},clients:{claim:()=>{}}},
 caches:{open:async()=>({addAll:async files=>{state.precached=files},put:async()=>{state.put=true}}),match:async(req,options)=>{state.fallback=options;return 'saved-shell'}},
 fetch:async req=>{requests.push(req);if(state.offline)throw Error('offline');return{ok:true,clone:()=>({})}}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../sw.js','utf8'),ctx);return {events,requests,state};
}
test('new offline shell bypasses stale HTTP cache during installation',async()=>{
 const w=worker();let install;w.events.install({waitUntil:p=>install=p});await install;assert.equal(w.state.precached.length,4);assert.ok(w.state.precached.every(r=>r.cache==='reload'));
});
test('page navigation fetches fresh HTML and keeps an offline fallback; version checks bypass worker cache',async()=>{
 const w=worker();const req={url:'https://example.test/cameras/?app-update=v18-123',method:'GET',mode:'navigate'};let response;w.events.fetch({request:req,respondWith:p=>response=p});await response;assert.equal(w.requests[0].cache,'no-store');
 w.state.offline=true;w.events.fetch({request:req,respondWith:p=>response=p});assert.equal(await response,'saved-shell');assert.equal(w.state.fallback.ignoreSearch,true);
 let intercepted=false;w.events.fetch({request:{url:'https://example.test/cameras/version.json?123',method:'GET'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});
