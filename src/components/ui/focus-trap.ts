// Focus helpers shared by Modal and DialogProvider. No dependency on purpose:
// both layers keep their current markup and only add keyboard rules.

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** Focusable elements in DOM order. */
export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
}

/**
 * Keeps Tab / Shift+Tab inside `container`. Only the wrap-around edges are
 * handled; moves between inner elements stay with the browser.
 */
export function trapTabKey(e: KeyboardEvent, container: HTMLElement) {
  const items = getFocusable(container);
  if (items.length === 0) {
    e.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const inside = active instanceof Node && container.contains(active);
  if (e.shiftKey && (!inside || active === first)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (!inside || active === last)) {
    e.preventDefault();
    first.focus();
  }
}

/**
 * A useDialog confirm (DialogProvider, rendered outside the Modal portal) can
 * sit on top of a sheet. Its overlay carries `data-dialog-layer`; while it is
 * up it owns Tab and Escape.
 */
export function dialogLayerOpen() {
  return document.querySelector("[data-dialog-layer]") !== null;
}
