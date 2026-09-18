const EXPLORER_OPEN_STORAGE_KEY = "pi-web:file-explorer:open";

/**
 * Key for the explorer pane height. The height value itself is read/written by
 * the shared useResizablePanel hook, but the key lives here next to the other
 * explorer preferences so the storage namespace stays in one place.
 */
export const EXPLORER_HEIGHT_STORAGE_KEY = "pi-web:file-explorer:height";

export const EXPLORER_MIN_HEIGHT = 120;
export const EXPLORER_DEFAULT_HEIGHT = 280;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadExplorerOpen(storage: StorageLike | null = getBrowserStorage()): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(EXPLORER_OPEN_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function saveExplorerOpen(
  open: boolean,
  storage: StorageLike | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(EXPLORER_OPEN_STORAGE_KEY, String(open));
  } catch {
    // Persistence is best-effort; privacy mode and storage quotas must not break the explorer.
  }
}
