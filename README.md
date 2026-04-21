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
- It watches Gmail's DOM with a `MutationObserver` and, for every open email, locates Gmail's reply control (aria-label `"Type of response"`) and the adjacent three-dot menu (aria-label `"More email options"`).
- That pair is what distinguishes the **per-email header toolbar** from the inbox-toolbar (which has a `"More email options"` button too, but no `"Type of response"` alongside it — and whose menu doesn't contain Reply all).
- It injects a styled Reply all button immediately after the reply control.
- On click, it programmatically opens the neighbouring More menu, locates the **Reply all** menuitem, and clicks it — same result as doing it by hand.

## Notes / gotchas

- The button always shows. On single-recipient emails there is no Reply all option, so clicking does nothing and the menu auto-closes after ~500 ms (via Escape).
- Gmail is localized. This ships with matchers for English (`"Reply all"`, `"Reply to all"`). If your Gmail language is something else, add the translated string to `findReplyAllMenuItem()` in `content.js`.
- Gmail ships DOM changes periodically. If Google restructures aria-labels, the selectors in `content.js` may need updating — specifically `[aria-label="Type of response"]` and `[aria-label="More email options"]`.

## Files

- `manifest.json` — MV3 manifest
- `content.js` — injection + click-routing logic
- `content.css` — button styling (light + dark theme)
- `icons/` — 16/48/128 px icons
