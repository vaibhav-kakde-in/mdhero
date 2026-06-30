import { writable } from "svelte/store";

export interface Toast {
  id: number;
  message: string;
}

export const toasts = writable<Toast[]>([]);

let nextId = 1;

/**
 * Show a transient toast message. Minimal by design — a single line of text,
 * auto-dismissed. Used for non-blocking notices like "file not found" from the
 * local-file-link handler (issue #30).
 */
export function showToast(message: string, durationMs = 3500): void {
  const id = nextId++;
  toasts.update((list) => [...list, { id, message }]);
  setTimeout(() => {
    toasts.update((list) => list.filter((t) => t.id !== id));
  }, durationMs);
}
