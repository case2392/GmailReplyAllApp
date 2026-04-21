// Gmail Reply All Button - content script
// For each open email header, injects a "Reply all" button between Gmail's
// reply control ("Type of response") and the three-dot "More email options"
// menu. Clicking it programmatically opens that menu and picks "Reply all".

(function () {
  'use strict';

  const INJECTED_ATTR = 'data-gm-reply-all-injected';
  const BUTTON_CLASS = 'gm-reply-all-btn';

  // Gmail's read-view reply control. Unique to the per-email header —
  // it does NOT appear in the inbox toolbar, so we use it to tell the
  // per-email-header ⋮ apart from the inbox-toolbar ⋮ (which has the same
  // aria-label but a menu without a "Reply all" item).
  const REPLY_ANCHOR_SELECTOR = '[aria-label="Type of response"]';
  const MORE_SELECTOR = '[role="button"][aria-label="More email options"]';

  const REPLY_ALL_ICON = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" d="M7 8V5l-7 7 7 7v-3l-4-4 4-4zm6 1V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
    </svg>
  `;

  function findReplyAllMenuItem() {
    const items = document.querySelectorAll('[role="menuitem"]');
    for (const item of items) {
      const text = (item.textContent || '').trim();
      const aria = item.getAttribute('aria-label') || '';
      if (
        /^reply all$/i.test(text) ||
        /^reply to all$/i.test(text) ||
        /\breply all\b/i.test(aria)
      ) {
        return item;
      }
    }
    return null;
  }

  function triggerReplyAll(moreBtn) {
    if (!moreBtn || !document.contains(moreBtn)) return;
    moreBtn.click();

    let attempts = 0;
    const maxAttempts = 25; // ~500ms
    const interval = setInterval(() => {
      attempts++;
      const item = findReplyAllMenuItem();
      if (item) {
        clearInterval(interval);
        item.click();
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        // Single-recipient email: no Reply all in the menu. Close it.
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );
      }
    }, 20);
  }

  // Walk up from the reply anchor to find a container that also holds a
  // "More email options" button. That pair is the per-email header toolbar.
  function findMoreButtonNear(anchor) {
    let cur = anchor.parentElement;
    for (let i = 0; i < 6 && cur; i++, cur = cur.parentElement) {
      const more = cur.querySelector(MORE_SELECTOR);
      if (more) return more;
    }
    return null;
  }

  function createButton(resolveMoreBtn) {
    const btn = document.createElement('div');
    btn.className = BUTTON_CLASS;
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', 'Reply all');
    btn.setAttribute('data-tooltip', 'Reply all');
    btn.setAttribute('tabindex', '0');
    btn.innerHTML = REPLY_ALL_ICON;

    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const moreBtn = resolveMoreBtn();
      if (moreBtn) triggerReplyAll(moreBtn);
    };

    btn.addEventListener('click', handler);
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') handler(e);
    });

    return btn;
  }

  function injectButtons() {
    const anchors = document.querySelectorAll(REPLY_ANCHOR_SELECTOR);
    anchors.forEach((anchor) => {
      if (anchor.hasAttribute(INJECTED_ATTR)) return;

      const moreBtn = findMoreButtonNear(anchor);
      if (!moreBtn) return;

      anchor.setAttribute(INJECTED_ATTR, '1');

      // Re-resolve on click in case Gmail re-rendered the toolbar since inject.
      const resolveMoreBtn = () =>
        document.contains(moreBtn) ? moreBtn : findMoreButtonNear(anchor);

      const btn = createButton(resolveMoreBtn);
      anchor.parentElement?.insertBefore(btn, anchor.nextSibling);
    });
  }

  injectButtons();

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        injectButtons();
        break;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  console.log('[Gmail Reply All Button] loaded');
})();
