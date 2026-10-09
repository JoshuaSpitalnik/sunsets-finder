# מוצא השקיעות · Sunset Finder

A Hebrew-first (RTL) PWA + native Android/iOS app (Capacitor) that predicts how good each
sunset will be over the next 7 days at your exact location, and (next milestone) where exactly
to stand for the best view. Tuned for Israel.

## How the prediction works
For every sunset the app pulls hourly forecasts from [Open-Meteo](https://open-meteo.com) (free, no
API key) for your location **and** for four points 25/50/100/200 km along the sunset direction:

- **High/mid cloud overhead (20–70%)** is the canvas that lights up. This is the biggest plus.
- **Low cloud along the light path** blocks the sun from lighting that canvas. This is the biggest minus.
- **Clearing after rain** is a bonus, and a bigger one in winter, when fronts bring Israel's best sunsets.
- **Aerosols / dust**: light dust deepens the reds. Heavy sharav mutes everything.
- **Visibility and humidity** affect clarity. Rain or low overcast at sunset is a penalty.

Each day gets a 0–100 score, a label (סתמית / נחמדה / מעולה / אפית), the reasons behind it, and a
confidence level that drops with lead time. All weights live in `src/lib/score.ts`.

## Screens
Design: Claude Design handoff "Sunset Finder" (warm light theme, Newsreader + Geist, with Frank Ruhl Libre + Heebo for Hebrew).
- **הערב / Tonight**: a full-bleed simulated sky with tonight's score and summary. Below it, a sheet with
  "be there by", a countdown, a 7-day strip, the light timeline and facing direction, the reasons, and
  reminder toggles. From golden hour until blue hour ends it switches to a dark **evening mode** with a
  countdown ring.
- **מפה / Map**: drag the pin or tap anywhere. The pin shows its score, and a live sunset-direction line
  follows it. The sheet has timings, a summary, Use this spot, Save, Waze, Google Maps, and **real sunset
  photos nearby** (Wikimedia Commons).
- **מקומות / Spots**: saved spots ranked by tonight's forecast, starting with five west-facing classics.
- **היסטוריה / History**: a calendar heatmap of past sunsets (7/30/90 days or a custom range since
  2022), scored from recorded weather, with the best days of the range.
- **עדכונים / Updates**: a scrollable feed of what Israeli weather sources are posting, with sunset
  clues highlighted (see below), a summary of what they say about tonight, and per-source reliability.
- **Notifications**: a reminder 30 minutes before golden hour, plus an alert when a saved spot scores 55+.
  Both are reliable in the Android/iOS apps; the PWA delivers them only while it's open.

## Forecasters' updates (OSINT)
Forecasters often spot what models miss: "ענני נוצה שעשויים לגרום לשקיעה יפה" is a strong hint.
- **Sources** (`src/lib/osint/sources.json`):
  - **Fetched automatically:** the IMS daily forecast and warnings, and the public Telegram channels
    התחזית ישראל, מחתרת מזג אוויר and חדשות מזג אוויר. ynet and Walla are included, filtered to weather stories.
  - **Shared by you:** WhatsApp channels (e.g. Tal Shamai) can't be read automatically. Share a post to
    the app (Android PWA share target) or paste it in Updates.
- **Collection:** the Pages workflow runs every 30 minutes, and `scripts/fetch-osint.mjs` writes
  `osint.json` next to the app.
- **Analysis** (`src/lib/osint/`) runs in the app, so shared posts go through the same logic:
  - it finds Hebrew/English clue words (ענני נוצה, עננות גבוהה, שקיעה יפה, התבהרות, גשם, אובך, שרב, ערפל…);
  - it ties each clue to a day (היום, מחר, בשלישי, (שני), 10/10, בעוד שבוע…);
  - it ignores negations ("ללא גשם"), softens hedges ("עשויים") and past reports ("ירדו גשמים"),
    and damps clues about other regions.
- **Scoring:** each day's score moves by up to ±12 points, weighted by source reliability
  (off/low/medium/high, adjustable) and post age (gone after 3 days). The weather-only score is always shown too.

## Development
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # scoring + sun-time unit tests
npm run build      # PWA build in dist/
```

## Running it on your phone
- **PWA (Android + iPhone):** open the deployed site, then use *Add to Home Screen* (Safari → Share on iPhone).
  The `Deploy PWA to GitHub Pages` workflow publishes it once Pages is enabled in the repo settings
  (Settings → Pages → Source: GitHub Actions).
- **Android app:** the `Android APK` workflow builds `app-debug.apk` on every push. Download it from the
  workflow run's artifacts and install it on the phone (allow "install unknown apps").
- **iOS app:** on a Mac with Xcode, run `npm run cap:sync && npx cap open ios`, then run it on your
  device. Installing needs an Apple ID, and TestFlight needs a paid developer account.

## Roadmap
1. ✅ PWA + Capacitor scaffold, Hebrew/RTL, GPS, sunset times, weather scoring, 7-day strip
2. ✅ Map with tap-to-explore, address search, sunset line, nearby photos; history search
3. ✅ Redesign: Spots, evening mode, calendar history, local notifications
4. ✅ Forecasters' updates feed (OSINT) nudging the score
5. OSM viewpoints, terrain horizon check, exact standing points
6. "Rate this sunset" and tuning the model to your ratings
