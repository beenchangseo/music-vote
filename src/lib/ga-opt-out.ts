// The visitor's choice, made on /privacy, to send nothing to Google Analytics from this browser.

const KEY = "plypick:ga-opt-out";
const CHANGE = "plypick:ga-opt-out-change";

// Set only when storage refused to keep the choice, so the switch still holds until the page closes.
let unsaved: boolean | null = null;

export function isGaOptedOut(): boolean {
  try {
    return unsaved ?? window.localStorage.getItem(KEY) === "1";
  } catch {
    return unsaved ?? false;
  }
}

export function setGaOptedOut(optedOut: boolean): void {
  try {
    if (optedOut) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
    unsaved = null;
  } catch {
    unsaved = optedOut;
  }
  // The storage event only reaches other tabs.
  window.dispatchEvent(new Event(CHANGE));
}

export function subscribeGaOptOut(onChange: () => void): () => void {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}
