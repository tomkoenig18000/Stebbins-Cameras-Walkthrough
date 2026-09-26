// Stebbins Camera Log uploader. Paste into Extensions → Apps Script on the Camera Log sheet.
// Set KEY below, Deploy → New deployment → Web app, Execute as: Me, Who has access: Anyone.
// Put the /exec URL and KEY into the app under Save → Log connection.
const KEY = 'change-me';
// Service Log header → app field. Columns are found by header name, so they can be moved.
// Date and Site must stay in columns A and B (lastDataRow and findRow read them).
const COLS = {'Date':'date','Site':'site','Type':'type','On arrival':'onArrival','Pics':'pics','GB used':'gbUsed',
  'Card out (GB)':'cardOut','Pic span (wk)':'span','Out 1.8':'out18','Out 1.7':'out17','Out 1.6':'out16',
  'Out 1.5':'out15','Out dead':'outDead','Batt in':'battIn','Card in (GB)':'cardIn','Settings changed':'settings','Notes':'notes'};
// Formula columns (Pics/wk, Card fill, Avg V out, Wks deployed, Res, Card, Batteries) are array formulas in row 2.
// Never write to them: anything in those cells blocks the formulas and turns the whole column into #REF!.

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const body = JSON.parse(e.postData.contents);
    if (body.key !== KEY) return out({ok:false, error:'wrong key'});
    const sh = SpreadsheetApp.getActive().getSheetByName('Service Log');
    const props = PropertiesService.getScriptProperties();
    const saved = [];
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    const where = Object.keys(COLS).map(h => [head.indexOf(h) + 1, COLS[h]]);
    const missing = Object.keys(COLS).filter(h => head.indexOf(h) < 0);
    if (missing.length) return out({ok:false, error:'Service Log is missing columns: ' + missing.join(', ')});
    body.rows.forEach(r => {
      const prev = props.getProperty('id_' + r.id);
      if (prev && !r.update) { saved.push(r.id); return; } // already uploaded
      const n = (prev && findRow(sh, prev)) || lastDataRow(sh) + 1; // edits overwrite their row
      where.forEach(([c, k]) => {
        const v = r[k];
        sh.getRange(n, c).setValue(v == null ? '' : v);
      });
      props.setProperty('id_' + r.id, JSON.stringify({n, date: r.date, site: r.site}));
      saved.push(r.id);
    });
    return out({ok:true, saved});
  } catch (err) { return out({ok:false, error:String(err)}); }
  finally { lock.releaseLock(); }
}
// Where an uploaded visit lives now. Rows can be inserted or sorted by hand after upload,
// so check the stored row still holds that visit's date and site before overwriting it.
function findRow(sh, prev) {
  let p; try { p = JSON.parse(prev); } catch (e) { return 0; }
  if (!p || !p.n || !p.date) return 0; // older uploads stored only a row number: append instead
  // The Date column may be formatted for display ("Fri Sep 26"), so compare as yyyy-MM-dd.
  const iso = v => v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(v);
  const matches = n => iso(sh.getRange('A' + n).getValue()) === p.date && sh.getRange('B' + n).getValue() === p.site;
  if (matches(p.n)) return p.n;
  const a = sh.getRange('A1:B' + lastDataRow(sh)).getValues();
  for (let i = 1; i < a.length; i++) if (iso(a[i][0]) === p.date && a[i][1] === p.site) return i + 1;
  return 0;
}
// Health check: open the /exec URL with ?key=... in a browser, or tap Test connection in the app.
function doGet(e) {
  const ok = e && e.parameter && e.parameter.key === KEY;
  return out(ok ? {ok:true, sheet: SpreadsheetApp.getActive().getName()} : {ok:false, error:'wrong key'});
}
function lastDataRow(sh) {
  const a = sh.getRange('A1:A' + sh.getMaxRows()).getValues();
  for (let i = a.length - 1; i >= 0; i--) if (a[i][0] !== '') return i + 1;
  return 1;
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
