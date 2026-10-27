const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const code=fs.readFileSync(__dirname+'/../apps-script/Code.gs','utf8');
function uploader(){
 const headers=['Date','Site','Res','Type','On arrival','Pics','Pic span (wk)','Pics/wk','Card','Batteries','Settings changed','Notes','GB used','Card out (GB)','Card in (GB)','Card fill','Out 1.8','Out 1.7','Out 1.6','Out 1.5','Out dead','Batt in','Avg V out','Wks deployed','Test'];
 const rows=[headers],props={};
 function range(r,c,h=1,w=1){if(typeof r==='string'){const m=r.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);const col=s=>[...s].reduce((a,ch)=>a*26+ch.charCodeAt(0)-64,0);c=col(m[1]);r=+m[2];w=m[3]?col(m[3])-c+1:1;h=m[4]?+m[4]-r+1:1}
  return {getValues:()=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>rows[r-1+i]?.[c-1+j]??'')),getValue:()=>rows[r-1]?.[c-1]??'',setValue:v=>{rows[r-1]??=[];rows[r-1][c-1]=v},setNote:()=>{}};
 }
 const sh={getRange:range,getLastColumn:()=>headers.length,getMaxRows:()=>100};
 const ctx=vm.createContext({Date,JSON,Object,Array,String,Error,Logger:{log:()=>{}},Session:{getScriptTimeZone:()=> 'America/Vancouver'},Utilities:{formatDate:d=>d.toISOString().slice(0,10)},LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},SpreadsheetApp:{getActive:()=>({getSheetByName:()=>sh,getName:()=> 'Test fixture'})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>props[k]=v,getProperties:()=>({...props})})},ContentService:{MimeType:{JSON:'application/json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}});
 vm.runInContext(code,ctx);
 return {rows,props,post:body=>ctx.doPost({postData:{contents:JSON.stringify({key:'change-me',...body})}}),mark:()=>ctx.markPriorAppUploadsAsTests()};
}
const visit={id:'one',site:'Lion Pool',date:'2026-10-27',type:'Service',notes:'Checked mount'};
test('capability check cannot write a visit',()=>{const u=uploader();assert.equal(u.post({action:'capabilities'}).capabilities.testMode,true);assert.equal(u.rows.length,1)});
test('explicit test and legacy uploads are flagged, while explicit real visits remain Service',()=>{
 for(const mode of [true,undefined,false]){const u=uploader();assert.equal(u.post({rows:[{...visit,test:mode}]}).ok,true);assert.equal(u.rows[1][3],mode===false?'Service':'Test');assert.equal(u.rows[1][24],mode!==false);assert.equal(u.rows[1][11].startsWith('[TEST]'),mode!==false)}
});
test('test classification survives edits and duplicate retries cannot create another row',()=>{
 const u=uploader();u.post({rows:[{...visit,test:true}]});u.post({rows:[{...visit,test:false,update:true}]});assert.equal(u.rows.length,2);assert.equal(u.rows[1][24],true);
 u.post({rows:[{...visit,test:false}]});assert.equal(u.rows.length,2);
});
test('maintenance marks only uploader-tracked historical rows',()=>{
 const u=uploader();u.rows.push(['2026-09-02','Lion Pool','','Service']);u.post({rows:[{...visit,test:false}]});u.mark();assert.equal(u.rows[1][3],'Service');assert.equal(u.rows[2][3],'Test');assert.equal(u.rows[2][24],true);
});
