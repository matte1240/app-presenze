/**
 * Collapsed/expanded state of the desktop sidebar, kept outside React so it
 * can be read through `useSyncExternalStore`.
 *
 * localStorage is the external system here: reading it in an effect and
 * pushing the result into state would cause the cascading render React 19
 * warns about, and would make the sidebar visibly snap on every load.
 */
const STORAGE_KEY = "sidebar:collapsed";

const listeners = new Set<() => void>();

/** Cached so getSnapshot returns a stable value between notifications. */
let snapshot: boolean | null = null;

function readStorage(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private browsing modes can throw on access; an expanded sidebar is a
    // safe default.
    return false;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeCollapsed(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab may change the preference.
  window.addEventListener("storage", onStorageEvent);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorageEvent);
    }
  };
}

function onStorageEvent(event: StorageEvent) {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  snapshot = null;
  emit();
}

export function getCollapsedSnapshot(): boolean {
  if (snapshot === null) snapshot = readStorage();
  return snapshot;
}

/** The server has no preference to read, so it always renders expanded. */
export function getCollapsedServerSnapshot(): boolean {
  return false;
}

export function toggleCollapsed(): void {
  const next = !getCollapsedSnapshot();
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Preference simply does not persist; the current session still works.
  }
  emit();
}
