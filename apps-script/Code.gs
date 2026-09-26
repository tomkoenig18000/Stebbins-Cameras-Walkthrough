// Stebbins Camera Log uploader. Paste into Extensions → Apps Script on the Camera Log sheet.
// Set KEY below, Deploy → New deployment → Web app, Execute as: Me, Who has access: Anyone.
// Put the /exec URL and KEY into the app under Save → Log connection.
const KEY = 'change-me';
const COLS = {A:'date',B:'site',C:'type',D:'onArrival',E:'pics',F:'gbUsed',G:'cardOut',H:'span',
  K:'out18',L:'out17',M:'out16',N:'out15',O:'outDead',Q:'battIn',R:'cardIn',T:'settings',U:'notes'};
const FORMULA_COLS = ['I','J','P','S']; // grey columns: copy formula from row 2

function doPost(e) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.key !== KEY) return out({ok:false, error:'wrong key'});
    const sh = SpreadsheetApp.getActive().getSheetByName('Service Log');
    const props = PropertiesService.getScriptProperties();
    const saved = [];
    body.rows.forEach(r => {
      const prev = props.getProperty('id_' + r.id);
      if (prev && !r.update) { saved.push(r.id); return; } // already uploaded
      const n = prev && prev !== '1' ? Number(prev) : lastDataRow(sh) + 1; // edits overwrite their row
      Object.entries(COLS).forEach(([c, k]) => {
        const v = r[k];
        sh.getRange(c + n).setValue(v == null ? '' : v);
      });
      FORMULA_COLS.forEach(c => sh.getRange(c + '2').copyTo(sh.getRange(c + n)));
      props.setProperty('id_' + r.id, String(n));
      saved.push(r.id);
    });
    return out({ok:true, saved});
  } catch (err) { return out({ok:false, error:String(err)}); }
  finally { lock.releaseLock(); }
}
function lastDataRow(sh) {
  const a = sh.getRange('A1:A' + sh.getMaxRows()).getValues();
  for (let i = a.length - 1; i >= 0; i--) if (a[i][0] !== '') return i + 1;
  return 1;
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
