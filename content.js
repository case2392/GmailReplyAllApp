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
    // Gmail pre-renders many hidden menus (help, inbox ⋮, other messages' ⋮).
    // Their menuitems stay in the DOM but have zero-size rects. Only the
    // just-opened menu's items are actually visible — match against those.
    const items = document.querySelectorAll('[role="menuitem"]');
    for (const item of items) {
      const r = item.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (item.getAttribute('aria-disabled') === 'true') continue;
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

  function startInjection() {
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
  }

  // At document_start, document.body may not exist yet.
  if (document.body) startInjection();
  else document.addEventListener('DOMContentLoaded', startInjection, { once: true });

  console.log('[Gmail Reply All Button] loaded');
})();

// Suppress Gmail's auto-expansion of the sidebar's "More" section when an
// email is dragged toward the sidebar. If the user had it collapsed before
// the drag, keep it collapsed throughout.
(function () {
  'use strict';

  const MORE_COLLAPSED = '[aria-label="More labels"]';
  const MORE_EXPANDED = '[aria-label="Less labels"]';

  let dragActive = false;
  let dragStartedCollapsed = false;

  const findToggle = () => document.querySelector(`${MORE_COLLAPSED}, ${MORE_EXPANDED}`);
  const isExpanded = (el) => el?.getAttribute('aria-label') === 'Less labels';

  function collapseNow() {
    const expanded = document.querySelector(MORE_EXPANDED);
    if (expanded) expanded.click();
  }

  function getMoreRowRect() {
    const toggle = findToggle();
    const row = toggle?.closest('.n6');
    return row?.getBoundingClientRect() || null;
  }

  function beginDrag() {
    if (dragActive) return;
    dragActive = true;
    const toggle = findToggle();
    // Only fight expansion if the user had it collapsed when the drag began;
    // a manually-expanded state should survive the drag.
    dragStartedCollapsed = !!toggle && !isExpanded(toggle);
    console.log('[Gmail Reply All Button] drag detected, startedCollapsed =', dragStartedCollapsed);
    if (dragStartedCollapsed) collapseNow();
  }

  const endDrag = () => {
    dragActive = false;
    dragStartedCollapsed = false;
  };

  document.addEventListener('dragstart', beginDrag, true);
  document.addEventListener('dragend', endDrag, true);
  document.addEventListener('drop', endDrag, true);

  // Gmail uses a custom mouse-based drag for emails — no dragstart fires.
  // Detect it: left-button mousedown, then movement past a threshold.
  let downPos = null;
  const onDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    downPos = { x: e.clientX, y: e.clientY };
  };
  const onMove = (e) => {
    if (!downPos || dragActive) return;
    const dx = e.clientX - downPos.x;
    const dy = e.clientY - downPos.y;
    if (Math.hypot(dx, dy) > 8) beginDrag();
  };
  const onUp = () => {
    downPos = null;
    if (dragActive) endDrag();
  };
  ['mousedown', 'pointerdown'].forEach((t) =>
    document.addEventListener(t, onDown, true)
  );
  ['mousemove', 'pointermove'].forEach((t) =>
    document.addEventListener(t, onMove, { capture: true, passive: true })
  );
  ['mouseup', 'pointerup', 'mouseleave'].forEach((t) =>
    document.addEventListener(t, onUp, true)
  );

  // Previous attempts set pointer-events: none on the More row/block, but
  // Gmail's expand handler sits on an ancestor that still receives events
  // — pointer-events only hides the element as a target, not as a bubble
  // path. Instead, intercept pointer events at the window capture phase:
  // when a drag is live and the cursor is within the More row's bounding
  // box, stopImmediatePropagation so no handler (including Gmail's) sees
  // the event. No sidebar-wide side effects.
  function interceptIfOverMoreRow(e) {
    if (!dragActive || !dragStartedCollapsed) return;
    const rect = getMoreRowRect();
    if (!rect) return;
    if (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    ) {
      e.stopImmediatePropagation();
    }
  }
  [
    'mousemove',
    'pointermove',
    'mouseover',
    'pointerover',
    'mouseenter',
    'pointerenter',
    'dragover',
    'dragenter',
  ].forEach((t) => {
    window.addEventListener(t, interceptIfOverMoreRow, true);
  });

  // Fallback: if the section still gets expanded for any reason, collapse it.
  const expansionObserver = new MutationObserver(() => {
    if (dragActive && dragStartedCollapsed) collapseNow();
  });

  function startObserving() {
    const toggle = findToggle();
    if (!toggle) {
      setTimeout(startObserving, 500);
      return;
    }
    const container =
      toggle.closest('.yJ, .nM, [role="navigation"]') || toggle.parentElement;
    expansionObserver.observe(container, {
      attributes: true,
      attributeFilter: ['aria-label'],
      subtree: true,
    });
  }
  startObserving();
})();
