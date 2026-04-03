# SoftBlock

Chrome extension (Manifest V3) to make a conscious decision when opening user-defined sites.

## Features

- Blocked domain list managed from the options page.
- Automatic detection when browsing or changing routes on SPA sites.
- Blocking in-page popup with a required decision:
  - Continue (choose 1, 5, 15, or 30 minutes before being asked again in the same tab).
  - Do not continue (closes the tab).
- Includes subdomains automatically.
- Local persistence with `chrome.storage.local`.

## Structure

- `manifest.json`
- `src/background/service-worker.js`
- `src/content/content-script.js`
- `src/options/options.html`
- `src/options/options.js`
- `src/options/options.css`

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this folder.
5. Open the extension options and add domains.

## Note

The extension cannot run on internal browser pages (`chrome://`).
