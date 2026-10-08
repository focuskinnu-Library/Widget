# Revoot for Android

The Android app for **https://revoot.in**, built as a Trusted Web Activity (TWA).
The app opens revoot.in full screen inside the phone's Chrome. It has no URL bar,
and it uses the same login, cookies, payments, camera uploads and web push as the
site. **Deploy the website and the app updates too.** You never resubmit to Play
for a content change.

| | |
|---|---|
| Package | `in.revoot.app` (permanent) |
| Target / min SDK | 36 (Android 16) / 26 (Android 8, ~99% of active devices) |
| Build | GitHub Actions → `.github/workflows/revoot-android.yml` |
| Output | `.aab` for Play, `.apk` for sideloading, both under the run's **Artifacts** |

Why a TWA rather than a WebView (Capacitor/Cordova): with a WebView, Google
sign-in is blocked, web push doesn't work, and the user has to log in again
separately from Chrome. A TWA has none of those problems and has no native code to maintain.

**Launch steps: see [LAUNCH.md](LAUNCH.md).**

## Files you'll touch
- `app/src/main/res/values/colors.xml`: brand colours
- `app/src/main/res/drawable/ic_launcher_foreground.xml`: **placeholder logo, replace it**
- `app/build.gradle`: `versionNm` for each release
- `web/.well-known/assetlinks.json`: goes on revoot.in, not in the app
