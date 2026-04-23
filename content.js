// Gmail Reply All Button - content script
// For each open email header, injects a "Reply all" button between the
// Reply control and the per-message ⋮ menu. Clicking it opens that menu
// and picks "Reply all" — same result as doing it by hand.

(function () {
  'use strict';

  const INJECTED_ATTR = 'data-gm-reply-all-injected';
  const BUTTON_CLASS = 'gm-reply-all-btn';

  const REPLY_SELECTOR = '[aria-label="Reply"]';

  // Gmail labels the per-message ⋮ differently across layouts:
  //   reading-pane / modern:  <button aria-label="More message options">
  //   full-thread / older:    <div role="button" aria-label="More email options">
  // We intentionally do NOT match the inbox-toolbar ⋮ ("More email options"
  // but nowhere near a Reply button) — findMoreNear requires the match to
  // share a close ancestor with the Reply anchor.
  const MORE_COMBINED = [
    '[aria-label="More message options"]',
    '[role="button"][aria-label="More email options"]',
  ].join(',');

  const REPLY_ALL_ICON = `<img src="https://ssl.gstatic.com/ui/v1/icons/mail/gm3/1x/reply_all_baseline_nv700_20dp.png" width="20" height="20" alt="" aria-hidden="true" draggable="false">`;

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

  function findMoreNear(reply) {
    let cur = reply.parentElement;
    for (let i = 0; i < 10 && cur; i++, cur = cur.parentElement) {
      const more = cur.querySelector(MORE_COMBINED);
      if (more) return more;
    }
    return null;
  }

  function createButton(resolveMoreBtn) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BUTTON_CLASS;
    btn.setAttribute('aria-label', 'Reply all');
    btn.setAttribute('title', 'Reply all');
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
    document.querySelectorAll(REPLY_SELECTOR).forEach((reply) => {
      if (reply.hasAttribute(INJECTED_ATTR)) return;
      const moreBtn = findMoreNear(reply);
      if (!moreBtn) return;
      reply.setAttribute(INJECTED_ATTR, '1');

      const resolveMoreBtn = () =>
        document.contains(moreBtn) ? moreBtn : findMoreNear(reply);

      const btn = createButton(resolveMoreBtn);

      // Reading-pane wraps each button in <span data-is-tooltip-wrapper>.
      // Insert after that wrapper so we become a toolbar-level sibling;
      // fall back to the reply element itself in layouts without wrappers.
      const anchor = reply.closest('[data-is-tooltip-wrapper]') || reply;
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
