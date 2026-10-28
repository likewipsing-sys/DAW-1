Hanbit Studio — an offline music studio for iPad (single-folder edition)

Every file sits in this one folder, so you can upload it from an iPad without any subfolders.

Put it on GitHub Pages (free)
  1. In Safari, sign in at github.com → + (top right) → New repository.
     Name it (e.g. hanbit-studio), choose Public, and tap Create repository.
  2. On the new repository page, tap "uploading an existing file".
  3. Tap "choose your files" → Browse → open this folder in Files → Select → select every file → Open.
  4. Scroll down and tap Commit changes.
  5. Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main, / (root) → Save.
  6. After a minute or two the page shows your address: https://<username>.github.io/<repository>/
  7. Open that address in Safari → Share → Add to Home Screen.
  8. Launch it once from the Home Screen icon. After that it runs without an internet connection.

Updating later: upload the new files to the same repository (same names replace the old ones) and commit.
The app picks up the new version the next time it’s opened online.

Files
  index.html              the whole app
  wt1-engine.js           WT-1 synth audio engine
  worklet-*.js            audio-thread processors
  sw.js                   offline cache (service worker)
  manifest.webmanifest    Home Screen app information
  icon-*.png, apple-touch-icon.png   app icons
  glass-bell.hbplug.js    example plugin (Library › Plugins › Import Plugin File)
  PLUGIN-SDK.md           how to build plugins

Note: opening index.html directly as a file disables the offline cache and some features. Always open it from the https address.
