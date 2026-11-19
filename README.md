# Lift Log

A free, offline workout logger that runs in your phone's browser. No account, no subscription, no premium features: everything is unlocked.

**Features**
- **Home:** a greeting with your name, level and XP, your streak with a Mon–Sun week strip, a weekly goal ring, and today's plan with a muscle preview and your last numbers. It also shows recent PRs, coach notes, badges and your Spotify gym playlist.
- **Logger:** tap ✓ after each set. Empty fields copy last session's numbers, and a rest timer starts automatically (it beeps and vibrates when time's up). There's a **Per side** toggle for one-side-at-a-time exercises like Bulgarian split squats, and a live workout clock.
- **Muscle map:** a low-poly front and back figure shaded by sets vs weekly target, for this week, last week or 4 weeks.
- **Charts:**
  - muscle balance radar
  - where your sets go
  - weekly volume
  - workouts per week
  - favourite training days
  - time of day you train
  - streak calendar
  - progress for each exercise, with PRs marked
- **Records and coach notes:** best lifts for each exercise, plus flags for stalled lifts and reps collapsing after a weight jump.
- **Profile:** name, avatar, goal, rest times, bodyweight log with a chart, and 21 badges.
- **Arrow import** and **backup/restore**.

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
| `figure.js` | The low-poly body figure used for muscle maps |
| `muscles.js` | Which muscles each exercise works, weekly targets and body-map shapes |
| `styles.css` | Styles, with automatic light and dark mode |
| `sw.js`, `manifest.json`, `icon.svg` | Offline support and home-screen install |

To get muscle-map credit for a new exercise, add it to `EXERCISE_MUSCLES` in `muscles.js`. Unknown names are matched by keyword (for example "curl" → biceps).

MIT licensed.
