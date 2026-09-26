# Stebbins Camera Service Walkthrough

A step-by-step phone app for servicing the Stebbins wildlife cameras. Works offline once it's on your home screen, and uploads each visit to the Service Log tab of the Stebbins Camera Log sheet.

## Install on a phone
Open the site in Safari, tap Share → Add to Home Screen. Open it once with signal so it saves itself for offline use.

## Connect to the Camera Log (one time)
1. Open the Camera Log sheet → Extensions → Apps Script. Paste `apps-script/Code.gs`, change `KEY`.
2. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
3. In the app: Save step → Log connection. Paste the `/exec` address and the key.

Visits wait on the phone until there's signal. The address and key are stored only on each phone, never in this repo.

## Updating the site list
Edit `SITES` near the top of the script in `index.html`, and bump `C` in `sw.js` so phones pick up the change.
