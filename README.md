# Lift Log

A free, offline workout logger that runs in your phone's browser. No account, no subscription, no premium features: everything is unlocked.

**Features**
- **Profile card:** a dog-tag style card on Home. Tap it to flip. The front has your avatar, level, member ID and a QR code; the back has your streak, workouts, total lifted, best lifts and 3 pinned badges.
- **Friends tab:** share your card link (or let someone scan the QR code). When a friend opens it, they can add you. There's a weekly leaderboard, live cards (with Drive sync on) showing their streak, last workout, muscles trained this week and recent PRs, plus a side-by-side comparison.
- **Avatars:** 12 built-in illustrated avatars, or upload your own photo (it's resized on your device).
- **54 badges** in six groups (Consistency, Streaks, Volume, Strength, Explorer, Lifestyle). Pin your favourite 3 to your showcase.
- **Logger:** tap ✓ after each set. Empty fields copy last session's numbers and the rest timer starts (with a beep and vibration). There's a per-side mode for one-side-at-a-time exercises and a live workout clock.
- **Muscle map, charts and stats:**
  - a low-poly muscle figure
  - muscle balance radar
  - where your sets go
  - weekly volume
  - workouts per week
  - favourite training days
  - time of day you train
  - streak calendar
  - progress for each exercise, with PRs and coach notes
- **Ask an AI coach:** one tap copies a 4-week training summary to paste into Claude, Gemini or ChatGPT.
- **Spotify:** your gym playlist plays from the home page.
- **Storage choice:** keep data on the device only, or auto-sync to your own Google Drive.
- **Themes:** 8 eye-friendly colour themes (Classic, Ocean, Forest, Sunset, Lavender, Sakura, Sand, Graphite), light, dark or auto mode, and Solid, Tinted or Glow backgrounds. There's a quick 🌙/☀️ toggle in the top bar.
- **Backup status chip** in the top bar: 💾 shows how long since your last backup, and ☁️ shows sync status. Tap it for exact timestamps and a **Back up now** button.
- **Import data** from Arrow (JSON), Strong (CSV), Hevy (CSV), any spreadsheet (CSV with date, exercise, weight, reps) or another Lift Log backup. The file type is detected automatically.

## Your data
Everything is stored in your browser on your own device (`localStorage`). Nothing is sent anywhere. Each person who opens the app has their own separate log. Download a backup from **Settings** every so often. Clearing your browser data deletes your log.

> Never commit your Arrow export or backup files to this repo. `.gitignore` already blocks them.

## Turn on Google Drive sync (optional, free, ~10 minutes, one time)
Each person's data is saved to a hidden app folder in **their own** Google Drive. The app can only see its own file, not the rest of your Drive (Google rates this permission as non-sensitive). Everything still works offline: changes are saved on the phone first and uploaded a few seconds later when you're online.

1. Go to <https://console.cloud.google.com/>, create a project (for example "Lift Log"), and open **APIs & Services**.
2. **Library:** search for **Google Drive API** and click **Enable**.
3. **OAuth consent screen** (or *Google Auth Platform → Branding*):
   - Choose **External**.
   - Fill in the app name and your email.
   - Under **Data access / Scopes**, add `.../auth/drive.appdata` (your private data) and `.../auth/drive.file` (only files this app creates, which is used for your public friend card). Both are non-sensitive scopes.
   - Under **Audience / Test users**, add your Gmail and your friend's Gmail. While the app is in "Testing" mode, only test users can sign in, which is fine for a small group (up to 100 people).
4. **Credentials → Create credentials → OAuth client ID → Web application.** Under **Authorized JavaScript origins**, add `https://<your-username>.github.io`.
5. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`) into `config.js`:
   ```js
   const LIFTLOG_CONFIG = { googleClientId: "1234-abc.apps.googleusercontent.com" };
   ```
   The Client ID is meant to be public, so committing it is fine. **Never** commit a *client secret*. This app doesn't use one.
6. *(Optional, for live friend cards)* Go to **Credentials → Create credentials → API key**. Then edit the key:
   - Under **Application restrictions**, choose **Websites** and add `https://<your-username>.github.io/*`.
   - Under **API restrictions**, choose **Google Drive API** only.

   Paste the key into `config.js` as `googleApiKey`. API keys for websites are visible to anyone by design, which is why you restrict them to your site and to Drive.
7. Commit, wait a minute, then in the app go to **Profile → Data & backup → Google Drive**.

**What friends can see:** with sync on, the app keeps one small file in your Drive called *Lift Log friend card.json*. It holds your name, avatar, level, streak, workout counts, best lifts, pinned badges, this week's muscle map and your last 3 PRs, and it's shared as "anyone with the link". Your full workout log stays private in the hidden app folder. To stop sharing, delete that file or turn sync off.

**Cost:** nothing. The Google Cloud project, the Drive API and GitHub Pages are all free at this scale, no billing account is needed, and the data lives in each person's own Drive storage.

When you open the app on a new phone, choose Google Drive and sign in, and all your data comes back. Google sign-ins expire after about an hour, so if the ☁️ badge shows **!**, tap it to sign in again.

## Put it online with GitHub Pages (free)
1. Create a new public repository on GitHub, for example `lift-log`.
2. Upload all the files in this folder (on the repo page, use **Add file → Upload files**).
3. Go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, then select the `main` branch and the `/ (root)` folder, and click **Save**.
4. After a minute or so, the app is live at `https://<your-username>.github.io/lift-log/`.

## Install on your phone
Open the link and add the app to your home screen:
- **iPhone (Safari):** tap Share, then **Add to Home Screen**.
- **Android (Chrome):** tap ⋮, then **Add to Home screen** (or **Install app**).

Once installed, it works offline at the gym.

## Sharing with a friend
Send them the app link (`https://<your-username>.github.io/lift-log/`), not the GitHub repo link. Their data stays on their phone and yours stays on yours. They can edit the routines in **Settings** to match their own split.

## Updating the app
After you change any file, update `VERSION` in `sw.js` (for example `liftlog-v4`) so phones pick up the new version.

## Files
| File | What it does |
|---|---|
| `index.html` | Page shell and tab bar |
| `app.js` | All app logic: logger, streak, charts, import and backup |
| `avatars.js` | Built-in avatar illustrations |
| `sync.js`, `config.js` | Optional Google Drive sync and its settings |
| `qrcode.js` | QR code generator (MIT, Kazuhiko Arase) |
| `figure.js` | The low-poly body figure used for muscle maps |
| `muscles.js` | Which muscles each exercise works, weekly targets and body-map shapes |
| `styles.css` | Styles, with automatic light and dark mode |
| `sw.js`, `manifest.json`, `icon.svg` | Offline support and home-screen install |

To get muscle-map credit for a new exercise, add it to `EXERCISE_MUSCLES` in `muscles.js`. Unknown names are matched by keyword (for example "curl" → biceps).

MIT licensed.
