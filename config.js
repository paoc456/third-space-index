/* =====================================================================
   THIRD SPACES — SETTINGS  (edit this file; no need to touch app.js)
   ===================================================================== */

/* 1) LIVE GOOGLE SHEET  — published CSV link (File → Share → Publish to web → CSV) */
window.THIRD_SPACES_CSV_URL = ""third-space-index.csv"";
window.THIRD_SPACES_EXTRA_CSV_URLS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSYQas2pZX83pMCFlJyn7IjCTZCgHl5KtyEDvID1ljJo1TwwEmbmiKBVwEh0kySYTuy8rwiu1u_02ue/pub?gid=186503157&single=true&output=csv";
window.THIRD_SPACES_REFRESH_MS = 300000;   // re-check the sheet every 5 min (0 = never)

/* 2) IMAGES — folder next to index.html. The sheet's [image] column should hold
      file names from this folder (e.g. 01_usagi.JPG). Several images: separate with  |  */
window.THIRD_SPACES_IMAGE_DIR = "images";
/* OPTIONAL — serve photos from somewhere other than this site's /images folder, so you can add
   photos WITHOUT redeploying the site. Must be a full https:// URL to a folder whose files you
   upload yourself and that allows cross-origin loading (GitHub raw / jsDelivr / most CDNs do).
   Examples:  "https://cdn.jsdelivr.net/gh/YOURUSER/YOURREPO@main/images"
              "https://raw.githubusercontent.com/YOURUSER/YOURREPO/main/images"
   Leave "" to use the folder above. */
window.THIRD_SPACES_IMAGE_BASE = "";

/* 3) HALFTONE — applied automatically to EVERY image (grid + popup) */
window.THIRD_SPACES_HALFTONE = {
  enabled: true,
  mode: "overlay",   // "overlay" = normal-colour photo + dot screen on top | "mono" = ink dots on paper | "cmyk" = colour print halftone
  dotsAcross: 120,         // dot columns across an image (higher = finer dots)
  overlayOpacity: 0.7,     // strength of the dot screen in "overlay" mode (0–1)
  angle: 45,          // grid angle in degrees (mono mode)
  contrast: 1.25,        // 1 = unchanged, higher = punchier
  brightness: 0.06,        // -0.3 … +0.3
  gamma: 0.75,        // below 1 lifts the shadows (dark photos), above 1 deepens them
  ink: "#141414",   // dot colour (mono)
  paper: "#f4f2ee"    // background colour
};

/* 4) SUBMIT FORM — paste the Apps Script web-app URL (ends in /exec) to send submissions straight
      into your Google Sheet. See README → "Making the Submit form write to the sheet" and
      submissions-apps-script.gs. If left "", the visitor's mail app opens to the address below. */
window.THIRD_SPACES_SUBMIT_ENDPOINT = "";

/* 4b) EASIEST — GOOGLE FORM (no script deployment / no admin permission needed).
       Paste a Google Form "pre-filled link" here. See README → "Submit form without Apps Script".
       Takes priority over the endpoint above. */
window.THIRD_SPACES_GOOGLE_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSe3S1XskfUWF4xpAEHaEu8jsHyYaVTssjZvh9ORVdohXOPfwg/viewform?usp=pp_url&entry.588886037=name&entry.1255091026=address&entry.1367515567=category&entry.1341884999=traits&entry.266073878=description&entry.448242897=images&entry.727839015=email";
window.THIRD_SPACES_SUBMIT_EMAIL = "thirdspaces@example.com";

/* 5) FILTERS
      value   = the word(s) used in the sheet      label = text on the button
      aliases = other spellings that should also match (handles sheet-vs-button wording) */
window.THIRD_SPACES_TRAIT_MATCH = "any";   // "any" = has at least one selected trait | "all" = has every one

window.THIRD_SPACES_FILTERS = {
  traits: [
    { value: "leveler", label: "leveler" },
    { value: "conversation", label: "conversation" },
    { value: "low profile", label: "low-profile" },
    { value: "home away from home", label: "home away from home" },
    { value: "playfulness", label: "playful", aliases: ["playful"] },
    { value: "regulars", label: "regulars" },
    { value: "neutral ground", label: "neutral ground" },
    { value: "accessibility", label: "accessibility" }
  ],
  categories: [
    { value: "bar / restaurant", label: "restaurant / bar", aliases: ["restaurant / bar", "restaurant/bar", "bar/restaurant"] },
    { value: "library / bookstore", label: "library / bookstore" },
    { value: "cafe", label: "cafe", aliases: ["café"] },
    { value: "greenery", label: "greenery" },
    { value: "open space", label: "open space" },
    { value: "art / music / cultural", label: "art / music / cultural", aliases: ["art / cultural", "art/cultural", "art / music", "arts / cultural"] },
    { value: "other", label: "other" }
  ],
  boroughs: ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"]
};
