# Stebbins Camera Service Walkthrough

A step-by-step phone app for servicing the Stebbins wildlife cameras. Works offline once it's on your home screen, and uploads each visit to the Service Log tab of the Stebbins Camera Log sheet.

Streamlined mode is on by default: one page for site, date, notes and work-done checkboxes. Trimming or repositioning reveals a photo checkbox. Use the toggle on Home to switch to the detailed walkthrough; the preference is saved on the phone. Quick visits record actions in notes and leave uncollected measurements blank.

The default palette is warm amber/brown in both light and dark appearances. Home → Settings → Testing mode changes the screen to red/orange and marks saved visits as tests. The uploader writes Type=Test, a Test checkbox and a [TEST] note; camera summaries exclude those rows, so nightly ArcGIS service status is unchanged by them. Saved tests remain tests when edited. All pre-v16 uploads were confirmed practice records and are classified as tests, including retries from older phones. A test upload is held locally if the connected uploader does not advertise testing-mode support.

The site dropdown is alphabetized and contains all 24 Active sites in the Camera Log as checked on October 27, 2026. “Test Site 4” is a real site name; only the explicit testing flag makes a visit a test.

## Install on a phone
Open the site in Safari, tap Share → Add to Home Screen. Open it once with signal so it saves itself for offline use.

## Connect to the Camera Log (one time)
1. Open the Camera Log sheet → Extensions → Apps Script. Paste `apps-script/Code.gs`, change `KEY`.
2. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
3. In the app: Save step → Log connection. Paste the `/exec` address and the key.

Visits wait on the phone until there's signal. The address and key are stored only on each phone, never in this repo.

## Updating the site list
Edit `SITES` near the top of the script in `index.html`.

## Publishing a change
Bump all three together so installed phones show the update banner: `APP_VERSION` in `index.html`, `version.json`, and `C` in `sw.js`.

The installed version is always visible in the top bar. A persistent blue update banner shows installed and available versions and an Update now button. Checks run when the app opens, returns to the foreground or comes online, and every minute while visible. Updating first saves the current visit, queued uploads and phone settings, then navigates with a cache-busting URL. An offline phone can keep working and update when connected. The first move from older app copies still uses their existing update prompt or a close/reopen.

Phone data is committed as one local snapshot before a visit is shown as saved. Storage failures keep the draft open and show a persistent warning. Legacy phone data migrates automatically; best-effort legacy copies are retained for older cached shells. Concurrent editing in several app tabs is not supported. Upload receipts are saved before a visit leaves the queue, and edits made during an upload are sent after that request finishes.
