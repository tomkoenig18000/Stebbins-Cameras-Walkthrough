// Stebbins Camera Log uploader. Paste into Extensions → Apps Script on the Camera Log sheet.
// Set KEY below, Deploy → New deployment → Web app, Execute as: Me, Who has access: Anyone.
// Put the /exec URL and KEY into the app under Save → Log connection.
const KEY = 'change-me';
const COLS = {A:'date',B:'site',C:'type',D:'onArrival',E:'pics',F:'gbUsed',G:'cardOut',H:'span',
  K:'out18',L:'out17',M:'out16',N:'out15',O:'outDead',Q:'battIn',R:'cardIn',T:'settings',U:'notes'};
// Grey columns I, J, P, S are filled by the array formulas in row 2. Never write to them:
// anything in those cells blocks the formulas and turns the whole column into #REF!.

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const body = JSON.parse(e.postData.contents);
    if (body.key !== KEY) return out({ok:false, error:'wrong key'});
    const sh = SpreadsheetApp.getActive().getSheetByName('Service Log');
    const props = PropertiesService.getScriptProperties();
    const saved = [];
    body.rows.forEach(r => {
      const prev = props.getProperty('id_' + r.id);
      if (prev && !r.update) { saved.push(r.id); return; } // already uploaded
      const n = (prev && findRow(sh, prev)) || lastDataRow(sh) + 1; // edits overwrite their row
      Object.entries(COLS).forEach(([c, k]) => {
        const v = r[k];
        sh.getRange(c + n).setValue(v == null ? '' : v);
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
  const matches = n => sh.getRange('A' + n).getDisplayValue() === p.date && sh.getRange('B' + n).getValue() === p.site;
  if (matches(p.n)) return p.n;
  const a = sh.getRange('A1:B' + lastDataRow(sh)).getDisplayValues();
  for (let i = 1; i < a.length; i++) if (a[i][0] === p.date && a[i][1] === p.site) return i + 1;
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
