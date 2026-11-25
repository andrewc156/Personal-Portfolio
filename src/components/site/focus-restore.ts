/**
 * Keep keyboard focus and the restored scroll position together after history
 * traversal (QA-11). Browser Back/Forward between in-page states (e.g. `/#research`
 * → `/`) restores the scroll position but leaves focus where it was, so focus can sit
 * on an offscreen link and the next Tab jumps the page back to it. After a traversal,
 * if the focused element is out of view, focus moves (without scrolling) to a visible
 * target: the fragment target when it is in view, otherwise the start of the page when
 * the viewport is at the top, otherwise the section at the top of the viewport.
 */

/** A popstate this soon after clicking a link to the new URL is that fragment navigation. */
const LINK_WINDOW_MS = 400;
const RESTORE_MARK = 'data-focus-restore';

let lastLinkClick = -Infinity;
let lastLinkHref = '';

function inView(el: Element): boolean {
  const rects = el.getClientRects();
  if (rects.length === 0) return false;
  const r = el.getBoundingClientRect();
  const h = window.innerHeight || document.documentElement.clientHeight;
  const w = window.innerWidth || document.documentElement.clientWidth;
  return r.bottom > 0 && r.top < h && r.right > 0 && r.left < w;
}

/** Focus without scrolling; non-focusable targets get a temporary tabindex="-1". */
function focusQuietly(el: HTMLElement): void {
  if (!el.hasAttribute('tabindex') && el.tabIndex < 0) {
    el.setAttribute('tabindex', '-1');
    el.setAttribute(RESTORE_MARK, '');
    el.addEventListener(
      'blur',
      () => {
        el.removeAttribute('tabindex');
        el.removeAttribute(RESTORE_MARK);
      },
      { once: true },
    );
  }
  el.focus({ preventScroll: true });
}

function fragmentTarget(): HTMLElement | null {
  const raw = location.hash.slice(1);
  if (!raw) return null;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    /* malformed escape: use it as written */
  }
  return document.getElementById(id);
}

/** The landmark/section at the top of the viewport, for mid-page restores. */
function sectionAtTop(): HTMLElement | null {
  const x = Math.round((window.innerWidth || 0) / 2);
  const hit = document.elementFromPoint(x, 1);
  return hit?.closest<HTMLElement>('section[id], section, article, main, header, footer') ?? null;
}

export function reconcileFocus(): void {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;
  if (active === document.body || active === document.documentElement) return;
  // Fixed UI (e.g. the open settings drawer) and visible elements keep focus.
  if (inView(active)) return;

  const target = fragmentTarget();
  if (target && inView(target)) {
    focusQuietly(target);
    return;
  }
  if (window.scrollY <= 1) {
    // Top of the page: the next Tab starts at the skip link and header.
    focusQuietly(document.body);
    return;
  }
  focusQuietly(sectionAtTop() ?? document.body);
}

/** Give up waiting for the restored scroll to settle after this long. */
const SETTLE_CAP_MS = 1000;
/** Frames with an unchanged scroll position that count as "settled". */
const STABLE_FRAMES = 3;

let settleRun = 0;

/**
 * Run after the browser has applied (and finished animating) its scroll restoration.
 * With `scroll-behavior: smooth` Chromium animates a same-document Back over ~300 ms,
 * so a fixed couple of frames is too early: the old focus is still in view mid-animation
 * and ends up far offscreen once the page lands. So focus is reconciled whenever the
 * scroll settles — on `scrollend` where supported, and otherwise once scrollY has been
 * unchanged for a few frames — and once more at the cap (about a second), after which
 * nothing is watched. reconcileFocus() only acts on offscreen focus, so repeats are safe.
 */
function afterRestore(): void {
  const run = ++settleRun;
  const live = (): boolean => run === settleRun;
  let polling = false;

  const poll = (): void => {
    if (polling) return;
    polling = true;
    let lastY = window.scrollY;
    let stable = 0;
    const tick = (): void => {
      if (!live()) return;
      const y = window.scrollY;
      if (y === lastY) stable += 1;
      else stable = 0;
      lastY = y;
      if (stable >= STABLE_FRAMES) {
        polling = false;
        reconcileFocus();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const onScroll = (): void => {
    if (live()) poll();
  };
  const onScrollEnd = (): void => {
    if (live()) reconcileFocus();
  };
  const stop = (): void => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('scrollend', onScrollEnd);
    if (live()) reconcileFocus();
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('scrollend', onScrollEnd);
  window.setTimeout(stop, SETTLE_CAP_MS);
  poll();
}

export function initFocusRestore(): void {
  document.addEventListener(
    'click',
    (e) => {
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (a instanceof HTMLAnchorElement) {
        lastLinkClick = performance.now();
        lastLinkHref = a.href;
      }
    },
    true,
  );
  window.addEventListener('popstate', () => {
    // A fragment link the visitor just followed lands on its own URL; Back/Forward don't.
    if (performance.now() - lastLinkClick < LINK_WINDOW_MS && location.href === lastLinkHref) {
      return;
    }
    afterRestore();
  });
  // Back/Forward cache restores keep the old focus too.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) afterRestore();
  });
}
