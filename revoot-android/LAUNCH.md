# Revoot → Google Play: the launch runbook

Status key: ✅ done in this repo · 👤 you · 🧑‍💻 whoever deploys revoot.in

## 0. Done already ✅
- Android project (TWA, API 36), CI that builds the signed `.aab` + `.apk`
- Upload signing key generated, plus its `assetlinks.json`
- Store listing draft, privacy-policy template, Data-safety answers (`store/`)

## 1. Today, 30 minutes

**1a. 👤 Add 4 GitHub secrets** (repo → Settings → Secrets and variables → Actions).
The values are in the private `GITHUB-SECRETS.txt` you were sent. Store that file and
`revoot-upload.jks` in a password manager. **Never commit them.**

**1b. 🧑‍💻 Put one file on the website:**
`web/.well-known/assetlinks.json` → `https://revoot.in/.well-known/assetlinks.json`

| Host | Where the file goes |
|---|---|
| Next.js / Vite / CRA / Lovable / Bolt | `public/.well-known/assetlinks.json` |
| Vercel / Netlify static | same, in the publish folder |
| WordPress / cPanel | upload to `public_html/.well-known/` |
| Shopify / Wix / Webflow | can't serve `.well-known`. Use a `app.revoot.in` subdomain on Vercel instead; ask me |

Check it: `curl -i https://revoot.in/.well-known/assetlinks.json`. You need **200**,
`content-type: application/json`, and **no redirect**. Then paste the URL into
https://developers.google.com/digital-asset-links/tools/generator.

If `revoot.in` redirects to `www.revoot.in`, the app and the file must use the final host.
Tell me and I'll switch it (one line in `strings.xml`).

**1c. 🧑‍💻 Site must have a web manifest** (`/manifest.json` with name, icons 192+512,
`theme_color`). Send me the theme colour and I'll match `colors.xml`.

## 2. Build the app ✅ automatic
After the secrets are in, go to Actions → **Revoot Android** → *Run workflow*. Download
the artifact: `app-release.aab` (Play) and `app-release.apk` (install on your phone to test).

Phone test: install the APK, then open it. **No URL bar = verification passed.** A URL bar at the
top means assetlinks is wrong or missing (step 1b).

## 3. Play Console, about 1 hour + Google's wait
1. 👤 https://play.google.com/console/signup. Pick **Personal**, pay **$25**, verify ID and phone.
   Takes 1–3 days. (An Organization account needs a D-U-N-S number but skips step 5's tester rule.)
2. Create app → name **Revoot**, App, Free, accept declarations.
3. **Setup → App signing**: keep *Google-managed key* (default). Upload the `.aab` to
   **Testing → Internal testing**.
4. **Critical, or the URL bar comes back:** Setup → App signing → copy the
   **App signing key certificate SHA-256**. Add it to `assetlinks.json` as a
   second entry in `sha256_cert_fingerprints` and redeploy the site. (Play re-signs the app,
   so phones see Google's key, not yours.) Or send it to me and I'll do it.
5. Fill **App content** with `store/data-safety.md` and **Store listing** with `store/listing.md`.
   Upload the privacy policy to `revoot.in/privacy` first.

## 4. The rule for new personal accounts 👤
A new personal developer account **cannot publish to Production** until it has run a
**closed test with at least 12 testers, opted in for 14 days in a row**. Plan for it:
- Make a Google Group, `revoot-testers@googlegroups.com`, and add 15+ people (3 spare, because
  people drop out). Friends, family, your first Revoot users.
- Testing → Closed testing → add the group → share the opt-in link.
- Each tester must install the app and **keep it installed** for 14 days.
- Day 15: Apply for production access (it asks a few questions about the test). Approval
  usually takes up to about 7 days.

**Realistic timeline: about 3–4 weeks from account creation to public on Play.**

## 5. Shipping updates
- Website changes: deploy the site. The app has them instantly.
- App shell changes (icon, colours, name): bump `versionNm` in `app/build.gradle`, run
  the workflow, upload the new `.aab`. `versionCode` increments automatically.

## Troubleshooting
| Symptom | Cause |
|---|---|
| URL bar visible at top | assetlinks missing, redirected, or lacks the **Play** SHA-256 (step 3.4) |
| Works for you, not testers | You installed the APK (your key) but they got the Play build (Google's key). Same fix |
| Google sign-in fails | It won't in a TWA. If it does, the site is opening `accounts.google.com` in an iframe. Use redirect/popup |
| CI build red | Open the run log and send it to me |
