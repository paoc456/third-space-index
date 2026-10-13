/* =====================================================================
   THIRD SPACES — SUBMISSIONS  ->  GOOGLE SHEET
   Paste this into  Extensions → Apps Script  (from inside your spreadsheet).
   Setup steps are in README.md ("Making the Submit form write to the sheet").

   Each submission becomes ONE ROW in the same column format as your index:
   [image] | # | place / name | address | oldenburg tag | category | decription
   ===================================================================== */
const CONFIG = {
  // 'Submissions' = safe: new rows land in a separate tab for you to review, then copy into Sheet1.
  // Change to 'Sheet1' to publish submissions to the live site instantly (no review!).
  TARGET_SHEET: 'Submissions',
  LIVE_SHEET:   'Sheet1',        // the tab your site reads (also used to copy headers + number rows)
  NOTIFY_EMAIL: ''               // optional: e.g. 'you@email.com' to get an email per submission
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const p = (e && e.parameter) || {};
    if (p.website) return reply_({ ok: true });                       // hidden spam-trap field was filled → silently drop

    const name = clean_(p.name, 120), address = clean_(p.address, 200);
    if (!name || !address) return reply_({ ok: false, error: 'name and address required' });

    const ss   = SpreadsheetApp.getActiveSpreadsheet();
    const live = ss.getSheetByName(CONFIG.LIVE_SHEET);
    let sh     = ss.getSheetByName(CONFIG.TARGET_SHEET);
    if (!sh) {                                                         // first run: create the tab with the same header row
      sh = ss.insertSheet(CONFIG.TARGET_SHEET);
      live.getRange(1, 1, 1, live.getLastColumn()).copyTo(sh.getRange(1, 1));
    }
    const isLive = sh.getName() === live.getName();

    // extra audit columns (only on the review tab, never on the live sheet)
    if (!isLive) { col_(sh, 'submitted at', true); col_(sh, 'email', true); }

    const headers = headers_(sh);
    const row = new Array(headers.length).fill('');
    const put = (names, value) => { const i = find_(headers, names); if (i > -1) row[i] = value; };

    put(['[image]', 'image', 'images'],            clean_(p.images, 500));
    put(['#', 'id', 'number'],                     nextNumber_(ss));
    put(['place / name', 'name', 'place'],         name);
    put(['address'],                               address);
    put(['oldenburg tag', 'oldenburg tags', 'tags'], list_(p.traits));        // "low profile, playfulness"  (lowercase, comma + space)
    put(['category', 'categories'],                clean_(p.category, 60).toLowerCase());
    put(['decription', 'description'],             clean_(p.description, 1500));
    put(['submitted at'],                          new Date());
    put(['email'],                                 clean_(p.email, 120));

    sh.appendRow(row);

    if (CONFIG.NOTIFY_EMAIL) {
      MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, 'New Third Space submission: ' + name,
        name + '\n' + address + '\n\n' + clean_(p.description, 1500) + '\n\nSheet tab: ' + sh.getName());
    }
    return reply_({ ok: true });
  } catch (err) {
    return reply_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return reply_({ ok: true, message: 'Third Spaces submissions endpoint is live.' }); }

/* Run this once from the editor (▶ testSubmission) to check the sheet tab + columns without using the website */
function testSubmission() {
  doPost({ parameter: { name: 'Test Space', address: '1 Main St, Brooklyn, NY 11201', category: 'cafe',
                        traits: 'leveler, conversation', description: 'Test entry — safe to delete.', email: 'test@example.com' } });
}

/* ---------------- helpers ---------------- */
function clean_(v, max) {
  let s = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max || 300);
  if (/^[=+\-@]/.test(s)) s = "'" + s;                                // stop spreadsheet-formula injection
  return s;
}
function list_(v) {                                                   // "Leveler,  Playful" -> "leveler, playful"
  return String(v || '').split(',').map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean).join(', ');
}
function headers_(sh) { return sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); }); }
function find_(headers, names) { for (var i = 0; i < names.length; i++) { var k = headers.indexOf(names[i]); if (k > -1) return k; } return -1; }
function col_(sh, name) { if (headers_(sh).indexOf(name) === -1) sh.getRange(1, sh.getLastColumn() + 1).setValue(name); }
function nextNumber_(ss) {                                            // highest "#" across the live + review tabs, plus one
  var max = 0;
  [CONFIG.LIVE_SHEET, CONFIG.TARGET_SHEET].forEach(function (n) {
    var s = ss.getSheetByName(n); if (!s || s.getLastRow() < 2) return;
    var i = headers_(s).indexOf('#'); if (i < 0) return;
    s.getRange(2, i + 1, s.getLastRow() - 1, 1).getValues().forEach(function (r) { var v = parseInt(r[0], 10); if (v > max) max = v; });
  });
  return max + 1;
}
function reply_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
