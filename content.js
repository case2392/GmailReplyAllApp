// Gmail Reply All Button - content script
// Injects a "Reply all" button right before Gmail's "More email options" (⋮) button.
// On click, programmatically opens that menu and selects "Reply all".

(function () {
  'use strict';

  const INJECTED_ATTR = 'data-gm-reply-all-injected';
  const BUTTON_CLASS = 'gm-reply-all-btn';

  // Reply-all SVG icon (inherits currentColor)
  const REPLY_ALL_ICON = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" d="M7 8V5l-7 7 7 7v-3l-4-4 4-4zm6 1V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
    </svg>
  `;

  // Match the "Reply all" menuitem in any open Gmail popup menu.
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

  // Click the More menu, wait for it to render, then click "Reply all".
  function triggerReplyAll(moreBtn) {
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
        // Close menu if Reply all isn't in it (e.g. single-recipient email)
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );
      }
    }, 20);
  }

  function createButton(moreBtn) {
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
      triggerReplyAll(moreBtn);
    };

    btn.addEventListener('click', handler);
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') handler(e);
    });

    return btn;
  }

  function injectButtons() {
    // Anchor off the 3-dot menu in each email's header toolbar.
    // Gmail labels this "More email options" (tooltip: "More").
    const moreButtons = document.querySelectorAll(
      '[role="button"][aria-label="More email options"]'
    );

    moreButtons.forEach((moreBtn) => {
      if (moreBtn.hasAttribute(INJECTED_ATTR)) return;
      moreBtn.setAttribute(INJECTED_ATTR, '1');

      const btn = createButton(moreBtn);
      if (moreBtn.parentElement) {
        moreBtn.parentElement.insertBefore(btn, moreBtn);
      }
    });
  }

  // Initial pass
  injectButtons();

  // Gmail re-renders frequently. Watch for new email headers.
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        injectButtons();
        break;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Log once so you can confirm the script is running
  console.log('[Gmail Reply All Button] loaded');
})();
