# Third Spaces — A Field Guide

No-build HTML/CSS/JS site. Open the folder in VS Code → right-click `index.html` → **Open with Live Server**.
(Opening the file directly as `file://` blocks the Google Sheet fetch and image processing.)

## Files
| File | Purpose |
|---|---|
| `index.html` | page structure (Index / Submit / About views + popup) |
| `styles.css` | all design — proportions come from your screenshots (`--u` = 1 screenshot px) |
| `app.js` | sheet loading, filters, popup gallery, halftone engine, image matching |
| `config.js` | **all settings**: sheet link, halftone, filters, submit form |
| `data.js` | bundled copy of the 100 places (used if the live sheet can't load) |
| `images/` | your photos + `manifest.js` (file list) |
| `submissions-apps-script.gs` | paste into Google Sheets → Apps Script so the Submit form writes rows |
| `update-images.js` | run `node update-images.js` after adding/removing photos |
| `third-space-index.csv` | spreadsheet export — `[image]` column now filled for the 16 existing photos |

## Spreadsheet columns
`[image]`, `#`, `place / name`, `address`, `oldenburg tag`, `category`, `decription` (or `description`), optional `borough`.
Edit the Google Sheet → changes appear on the site (live link is in `config.js`; Google can take a few minutes to republish).

## Images ↔ the `[image]` column
1. Put photos in `images/` (≈1400px on the long side is plenty).
2. In the sheet's `[image]` cell type the **file name**, e.g. `01_usagi.JPG`. Case and extension don't matter.
   Several photos → separate with `|` : `01_usagi.JPG | 01_usagi-2.JPG` (popup becomes a carousel).
   Full web URLs also work (Google Drive "anyone with link" links are converted; the host must allow CORS to be halftoned, otherwise the original shows).
3. **Cell left blank?** Any file whose name starts with the entry number (`07_flowingspace.png` → entry #7) is used automatically.
4. Run `node update-images.js` — it rebuilds `images/manifest.json` + `manifest.js` and **checks the sheet against the folder**
   (missing files, unused photos, files over 2 MB). Add `--csv third-space-index.csv` to check a local CSV instead.

## Getting local photos onto the LIVE site
The live page can only show files that are on the internet — the sheet updates itself, but photos on your computer have to be uploaded to wherever the site is hosted. Two ways:

**A. Photos live with the site (default).** After step 4 above, upload/redeploy the `images/` folder (drag-and-drop on Netlify/Cloudflare Pages, `git push` on GitHub Pages/Vercel, or FTP). The live page re-reads `images/manifest.json` every 5 minutes, so as long as that file and the photos are uploaded, **no code changes are needed** — type the file name in the sheet and it appears.

**B. Photos live in their own folder (no site redeploy ever).** Create a public GitHub repo with an `images/` folder, drag photos in on github.com (or `git push`), then in `config.js` set
`THIRD_SPACES_IMAGE_BASE = "https://cdn.jsdelivr.net/gh/YOURUSER/YOURREPO@main/images"`.
Upload `manifest.json` alongside the photos if you want the blank-cell / entry-number matching; explicit file names in the sheet work without it. (jsDelivr caches ~12 h; `raw.githubusercontent.com/YOURUSER/YOURREPO/main/images` is near-instant but slower.)

## Fonts — ABC ROM Variable (body) + Exposure [-10] (titles)
Licensed fonts can't be bundled. Put web-font files in `fonts/` named `ABCROMVariable.woff2` and `Exposure-10.woff2` (see `fonts/README.txt`).
The two `@font-face` blocks and the `--sans` / `--serif` variables at the top of `styles.css` already point at them, with Hanken Grotesk / Newsreader as fallbacks (delete the Google Fonts `<link>` in `index.html` once your files are in). Type is sized to your design's proportions; if Exposure sets wider/narrower than the placeholder, adjust `letter-spacing` on `.about-title`, `.nav-button`, `.card-name`, `.modal-copy h2`.

## Submit form without Apps Script (Google Form → your sheet)
Use this if Apps Script won't let you deploy (common with school/work Google accounts).

1. Go to **forms.google.com** → new form. Add **seven "Short answer" questions** (use short answer for all of them, even category and traits —
   dropdowns/checkboxes reject any value that doesn't match exactly), in this order:
   *Place name · Address · Category · Oldenburg traits · Description · Image link · Email*.
   Make the first two **Required**. In **Settings → Responses**, turn **off** "Restrict to users in…" and "Limit to 1 response" so visitors needn't sign in.
2. Click **Responses → Link to Sheets** and choose your spreadsheet (this adds a *Form Responses 1* tab — it doesn't touch Sheet1).
3. Click **⋮ (top right) → Get pre-filled link**. In each question type the matching keyword, exactly:
   `name`, `address`, `category`, `traits`, `description`, `images`, `email` → **Get link** → **Copy link**.
4. Paste that link into `config.js`: `window.THIRD_SPACES_GOOGLE_FORM = "https://docs.google.com/forms/d/e/…/viewform?usp=pp_url&entry.123=name&entry.456=address…";` and re-upload `config.js`.
5. Send a test from the site → it appears in **Form Responses 1** within seconds.

**Getting them into the index format:** in your spreadsheet add a tab called `Review`, click cell A1 and paste this (it reshapes new responses into
`[image] | # | place / name | address | oldenburg tag | category | decription`; `#` is a placeholder — retype it):
```
=ARRAYFORMULA(FILTER({'Form Responses 1'!G2:G, ROW('Form Responses 1'!B2:B)+99, 'Form Responses 1'!B2:B, 'Form Responses 1'!C2:C, LOWER('Form Responses 1'!E2:E), LOWER('Form Responses 1'!D2:D), 'Form Responses 1'!F2:F}, 'Form Responses 1'!B2:B<>""))
```
(If your question order differs, change the column letters: B = 1st question, C = 2nd … H = 7th.) To publish an entry: copy its row from `Review` (Edit → Paste special → *Values only*) to the bottom of **Sheet1**.

**Other options:** *Formspree / Basin / Getform* (free tiers email you each submission): put their form URL in `THIRD_SPACES_SUBMIT_ENDPOINT` and copy entries into the sheet by hand.
*Make.com / Zapier* can add rows to Sheet1 automatically using your own Google login — no deployment needed, but the free plans are limited.
*Apps Script:* if it says you're not authorised, you're likely on a Workspace (school/work) account whose admin blocks public web apps — create the sheet under a personal Gmail instead. On the "Google hasn't verified this app" screen choose **Advanced → Go to (project) (unsafe)**.

## Publishing on GitHub (GitHub Pages, free)
The site is plain HTML/CSS/JS, so GitHub Pages hosts it as-is — no build step.

**One-time setup**
1. Create a GitHub account → **New repository** (e.g. `third-space-index`), set it to **Public**.
2. Upload the project: on the repo page choose **Add file → Upload files**, drag in the *contents* of this folder
   (`index.html`, `app.js`, `styles.css`, `config.js`, `data.js`, the `images/` and `fonts/` folders, `.nojekyll` …) → **Commit changes**.
   Or with Terminal inside the folder:
   ```
   git init && git add . && git commit -m "first version"
   git branch -M main
   git remote add origin https://github.com/YOURUSER/third-space-index.git
   git push -u origin main
   ```
3. **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, Folder = `/ (root)` → **Save**.
4. After ~1 minute the site is live at `https://YOURUSER.github.io/third-space-index/` (Settings → Pages shows the link).

**Updating the live site later**
- *Spreadsheet text:* nothing to do — the site reads the sheet itself.
- *New photos:* run `node update-images.js`, then on GitHub open `images/` → **Add file → Upload files** → drop the new photos **and** the regenerated `manifest.json` / `manifest.js` → Commit. Live in about a minute. Then type the file names in the sheet.
- *Design/code changes:* upload the changed file(s) the same way (or `git add . && git commit -m "update" && git push`).

**Things to know**
- **Fonts:** ABC ROM Variable and Exposure [-10] only appear for visitors if the web-font files are in `fonts/` (`ABCROMVariable.woff2`, `Exposure-10.woff2`) — fonts installed on your own computer are not available to visitors. Check your font licences allow web use on your domain; a public repo makes the font files downloadable, so if the licence is restrictive use a private repo with Pages (paid plan) or another host.
- **File names are case-sensitive on GitHub** (`01_usagi.JPG` ≠ `01_usagi.jpg`). The site matches names case-insensitively through `images/manifest.json`, so keep that file up to date.
- **Hard-refresh** (Cmd/Ctrl + Shift + R) if you don't see an update straight away; GitHub caches for a few minutes.
- The Google Sheet link and the Apps Script submit URL are public by design (the sheet is published to the web). Never put passwords or private keys in these files.
- Limits: repo under ~1 GB, single files under 100 MB, site under 1 GB. The images folder is ~26 MB.
- **Custom domain:** Settings → Pages → *Custom domain*, then add the DNS records GitHub shows you.

## Collapsible sidebar
The **‹** button at the end of the sidebar's nav row collapses it, leaving a hamburger button with "Third Space Index" and a one-line caption in the top-left corner (click it to expand). The title uses `mix-blend-mode: difference` so it stays readable over photos; for a plain look set `mix-blend-mode:normal; color:#111` on `.collapsed-brand` / `.brand-toggle`. With the sidebar collapsed, the grid is never blurred, even on About/Submit; the grid then expands from 3 to 5 columns (4 on mid-size screens, 3 on small ones). The choice is remembered. Opening About or Submit re-opens the sidebar automatically. On phones the sidebar is always a top panel.

## Halftone
Applied automatically to every image in the grid and popup — nothing to prepare. Tune in `config.js` → `THIRD_SPACES_HALFTONE`:
`mode` ("overlay" = normal colour photo with dots on top, "mono", or "cmyk"), `overlayOpacity`, `dotsAcross` (dot size), `angle`, `contrast`, `brightness`, `gamma`, `ink`, `paper`.
Set `enabled:false` to show the untouched photos.

## Filters
Matching is forgiving: `restaurant / bar` = sheet's `bar / restaurant`; `art / music / cultural` also accepts `art / cultural`; `playful` = `playfulness`; `low-profile` = `low profile`. Add more spellings under `aliases` in `config.js`. A new category/trait typed into the sheet automatically gets its own filter button. Traits use "any" matching; set `THIRD_SPACES_TRAIT_MATCH = "all"` to require every selected trait.

## Making the Submit form write to the sheet
The Submit tab can add each entry as a new row in your Google Sheet, in the same format as the index
(`[image] | # | place / name | address | oldenburg tag | category | decription`, tags lowercase and comma-separated, `#` = next number).

1. Open your Google Sheet → **Extensions → Apps Script**. Delete the sample code, paste in everything from `submissions-apps-script.gs`, click **Save**.
2. Pick `testSubmission` in the function dropdown and click **Run** (approve the permissions prompt: "Advanced → Go to project"). A **Submissions** tab appears with a test row — delete that row.
3. **Deploy → New deployment → ⚙ Web app** · Execute as: **Me** · Who has access: **Anyone** → **Deploy** → copy the **Web app URL** (ends in `/exec`).
4. Paste it into `config.js`: `window.THIRD_SPACES_SUBMIT_ENDPOINT = "https://script.google.com/macros/s/…/exec";` and re-upload `config.js`.
5. Submit a test from the live site; a row should appear in the **Submissions** tab within seconds.

**Review flow (default):** submissions land in a separate **Submissions** tab (with extra *submitted at* and *email* columns). To publish one, copy its row's first seven columns into the bottom of **Sheet1** and type the photo's file name in `[image]` — it then shows on the site at the next refresh. The `Submissions` tab is not published, so the public never sees pending entries.
**Instant publishing:** set `TARGET_SHEET: 'Sheet1'` at the top of the script to skip review — anything submitted goes live immediately, spam included.
**If you edit the script later:** Deploy → *Manage deployments* → ✏ → Version: *New version* → Deploy (the URL stays the same).
A hidden spam-trap field is included; set `NOTIFY_EMAIL` in the script to get an email per submission.
Images: the form's "Image link" box accepts a web URL. Visitors can't upload files, so for your own photos add the file name to `[image]` after review.
If no endpoint is set, the form opens the visitor's email app, addressed to `THIRD_SPACES_SUBMIT_EMAIL`.

## Limits
The site only *reads* the sheet; it doesn't write back or have an admin login.
