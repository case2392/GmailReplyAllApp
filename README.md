# Gmail Reply All Button

A tiny Chrome extension that adds a **Reply all** button directly in Gmail's email-header toolbar, right next to the existing Reply button — no more clicking the 3-dot menu.

## Install (unpacked, developer mode)

1. Unzip the folder somewhere permanent (e.g. `~/chrome-extensions/gmail-reply-all`).
2. Open `chrome://extensions` in Chrome.
3. Toggle **Developer mode** on (top right).
4. Click **Load unpacked** and select the `gmail-reply-all` folder.
5. Open Gmail. The new Reply all icon appears next to Reply in every email's header.

To update the extension later, edit files and click the refresh icon on its tile at `chrome://extensions`.

## How it works

- A content script runs on `https://mail.google.com/*`.
- It watches Gmail's DOM with a `MutationObserver` and, for every open email, anchors off the Reply button (`[aria-label="Reply"]`). From that anchor it walks up the DOM to find the nearest per-message ⋮ button — matching either `[aria-label="More message options"]` (reading-pane / modern layout) or `[role="button"][aria-label="More email options"]` (full-thread / older layout).
- Requiring a ⋮ match in a close ancestor of the Reply anchor is what keeps us from injecting next to the unrelated inbox-toolbar ⋮.
- It injects a styled Reply all button immediately after the Reply control's tooltip wrapper, so the toolbar reads `[Reply] [Reply all] [⋮]`.
- On click, it programmatically opens that same ⋮ menu, locates the **Reply all** menuitem, and clicks it — same result as doing it by hand.

## Notes / gotchas

- The button always shows. On single-recipient emails there is no Reply all option, so clicking does nothing and the menu auto-closes after ~500 ms (via Escape).
- Gmail is localized. This ships with matchers for English (`"Reply all"`, `"Reply to all"`). If your Gmail language is something else, add the translated string to `findReplyAllMenuItem()` in `content.js`.
- Gmail ships DOM changes periodically. If Google restructures aria-labels, the selectors in `content.js` may need updating — specifically `[aria-label="Reply"]`, `[aria-label="More message options"]`, and `[aria-label="More email options"]`.

## Files

- `manifest.json` — MV3 manifest
- `content.js` — injection + click-routing logic
- `content.css` — button styling (light + dark theme)

No extension icons are bundled yet; Chrome shows the default puzzle-piece tile. To add your own, drop `icon16.png` / `icon48.png` / `icon128.png` into an `icons/` folder and re-add the `"icons": { ... }` block to `manifest.json`.
