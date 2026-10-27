# Stebbins Camera Service Walkthrough

A step-by-step phone app for servicing the Stebbins wildlife cameras. Works offline once it's on your home screen, and uploads each visit to the Service Log tab of the Stebbins Camera Log sheet.

Streamlined mode is on by default: one page for site, date, arrival condition, notes and work-done checkboxes. Trimming or repositioning reveals a photo checkbox. Use the toggle on Home to switch to the detailed walkthrough; the preference is saved on the phone. Quick visits record actions in notes and leave uncollected measurements blank.

Home → Settings → Testing mode changes the screen to amber and marks saved visits as tests. The uploader writes Type=Test, a Test checkbox and a [TEST] note; camera summaries exclude those rows, so nightly ArcGIS service status is unchanged by them. Saved tests remain tests when edited. All pre-v16 uploads were confirmed practice records and are classified as tests, including retries from older phones. A test upload is held locally if the connected uploader does not advertise testing-mode support.

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
Bump all three together so installed phones show the "New version ready" button: `APP_VERSION` in `index.html`, `version.json`, and `C` in `sw.js`.
