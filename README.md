# Lift Log

A free, offline workout logger that runs in your phone's browser. No account, no subscription, no premium features: everything is unlocked.

**Features**
- **Logger:** your weekly routines are preloaded. Each exercise shows what you did last time, so you know what to beat.
- **Streak:** rest days count, just like in Arrow. You also get a GitHub-style calendar of your training days.
- **Progress charts:** top weight, estimated 1RM or volume for every exercise, with personal bests marked.
- **Muscle map:** a front and back body diagram shaded by how many sets each muscle got this week, compared with a weekly target.
- **Coach notes:** flags when your reps collapse after a weight jump, when a lift has stalled for 5 weeks, and when you set a new best.
- **Arrow import:** load the JSON export Arrow emails you, and your full history and streak come across.
- **Backups:** download a backup file and restore it on any device.

## Your data
Everything is stored in your browser on your own device (`localStorage`). Nothing is sent anywhere. Each person who opens the app has their own separate log. Download a backup from **Settings** every so often. Clearing your browser data deletes your log.

> Never commit your Arrow export or backup files to this repo. `.gitignore` already blocks them.

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
Send them the same link. Their data stays on their phone and yours stays on yours. They can edit the routines in **Settings** to match their own split.

## Updating the app
After you change any file, update `VERSION` in `sw.js` (for example `liftlog-v2`) so phones pick up the new version.

## Files
| File | What it does |
|---|---|
| `index.html` | Page shell and tab bar |
| `app.js` | All app logic: logger, streak, charts, import and backup |
| `muscles.js` | Which muscles each exercise works, weekly targets and body-map shapes |
| `styles.css` | Styles, with automatic light and dark mode |
| `sw.js`, `manifest.json`, `icon.svg` | Offline support and home-screen install |

To get muscle-map credit for a new exercise, add it to `EXERCISE_MUSCLES` in `muscles.js`. Unknown names are matched by keyword (for example "curl" → biceps).

MIT licensed.
