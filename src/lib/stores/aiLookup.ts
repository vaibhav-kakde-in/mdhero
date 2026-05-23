import { writable, get } from "svelte/store";

const STORAGE_KEY = "mdhero:aiLookup";
const SCHEMA_VERSION = 1 as const;

export interface Prompt {
  /** Stable UUID for menu IDs. */
  id: string;
  /** Display name in the submenu, e.g. "Company background". */
  name: string;
  /** Prompt body. `{selection}` is replaced with the user's selected text. */
  template: string;
}

export interface Provider {
  /** Stable UUID for menu IDs and references. */
  id: string;
  /** Display name in menu + settings, e.g. "ChatGPT". */
  name: string;
  /** URL template containing the literal token `{prompt}`. The token is
   *  substituted with the URL-encoded, already-filled prompt. */
  urlTemplate: string;
  prompts: Prompt[];
}

export interface AILookupStore {
  schemaVersion: typeof SCHEMA_VERSION;
  providers: Provider[];
  /** ID of the provider used for the Custom prompt modal by default. May be
   *  an empty string when no providers exist. */
  defaultProviderId: string;
}

/** Default providers + prompts shipped on first install. The starter prompts
 *  under ChatGPT prevent an empty submenu the first time someone right-clicks. */
const DEFAULTS: AILookupStore = {
  schemaVersion: SCHEMA_VERSION,
  defaultProviderId: "default-chatgpt",
  providers: [
    {
      id: "default-chatgpt",
      name: "ChatGPT",
      urlTemplate: "https://chatgpt.com/?q={prompt}",
      prompts: [
        {
          id: "default-chatgpt-explain",
          name: "Explain this clearly",
          template: "Explain this clearly: {selection}",
        },
        {
          id: "default-chatgpt-summarize",
          name: "Summarize",
          template: "Summarize this concisely: {selection}",
        },
      ],
    },
    {
      id: "default-claude",
      name: "Claude",
      urlTemplate: "https://claude.ai/new?q={prompt}",
      prompts: [],
    },
    {
      id: "default-perplexity",
      name: "Perplexity",
      urlTemplate: "https://www.perplexity.ai/?q={prompt}",
      prompts: [],
    },
    {
      id: "default-google",
      name: "Google Search",
      urlTemplate: "https://www.google.com/search?q={prompt}",
      prompts: [{ id: "default-google-search", name: "Search", template: "{selection}" }],
    },
    {
      id: "default-wikipedia",
      name: "Wikipedia",
      urlTemplate: "https://en.wikipedia.org/wiki/Special:Search?search={prompt}",
      prompts: [{ id: "default-wikipedia-lookup", name: "Look up", template: "{selection}" }],
    },
  ],
};

function isValidStore(raw: unknown): raw is AILookupStore {
  if (!raw || typeof raw !== "object") return false;
  const s = raw as Partial<AILookupStore>;
  return (
    s.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(s.providers) &&
    typeof s.defaultProviderId === "string"
  );
}

function load(): AILookupStore {
  if (typeof localStorage === "undefined") return structuredClone(DEFAULTS);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    if (!isValidStore(parsed)) return structuredClone(DEFAULTS);
    return parsed;
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function persist(s: AILookupStore) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

const store = writable<AILookupStore>(load());

function update(fn: (s: AILookupStore) => AILookupStore) {
  store.update((s) => {
    const next = fn(s);
    persist(next);
    return next;
  });
}

function newId(): string {
  // crypto.randomUUID is available in all Tauri webviews (Safari/WKWebView and Edge/WebView2)
  return crypto.randomUUID();
}

/** Validate a provider URL template. Must contain the literal `{prompt}` token
 *  exactly once. Surface the returned error string in the settings UI. */
export function validateProviderUrl(template: string): string | null {
  if (!template.trim()) return "URL is required";
  const matches = template.match(/\{prompt\}/g);
  if (!matches) return "URL must contain {prompt} where the query goes";
  if (matches.length > 1) return "URL must contain {prompt} only once";
  try {
    // Plug a placeholder so URL constructor accepts it
    new URL(template.replace("{prompt}", "x"));
  } catch {
    return "URL is not valid";
  }
  return null;
}

export function addProvider(name: string, urlTemplate: string): string {
  const id = newId();
  update((s) => ({
    ...s,
    providers: [...s.providers, { id, name, urlTemplate, prompts: [] }],
    // First provider added to an empty store becomes the default
    defaultProviderId: s.defaultProviderId || id,
  }));
  return id;
}

export function removeProvider(providerId: string) {
  update((s) => {
    const providers = s.providers.filter((p) => p.id !== providerId);
    // Reassign default if it pointed at the removed provider
    const defaultProviderId =
      s.defaultProviderId === providerId
        ? providers[0]?.id ?? ""
        : s.defaultProviderId;
    return { ...s, providers, defaultProviderId };
  });
}

export function updateProvider(
  providerId: string,
  patch: Partial<Pick<Provider, "name" | "urlTemplate">>,
) {
  update((s) => ({
    ...s,
    providers: s.providers.map((p) =>
      p.id === providerId ? { ...p, ...patch } : p,
    ),
  }));
}

export function addPrompt(providerId: string, name: string, template: string): string {
  const id = newId();
  update((s) => ({
    ...s,
    providers: s.providers.map((p) =>
      p.id === providerId ? { ...p, prompts: [...p.prompts, { id, name, template }] } : p,
    ),
  }));
  return id;
}

export function removePrompt(providerId: string, promptId: string) {
  update((s) => ({
    ...s,
    providers: s.providers.map((p) =>
      p.id === providerId
        ? { ...p, prompts: p.prompts.filter((x) => x.id !== promptId) }
        : p,
    ),
  }));
}

export function updatePrompt(
  providerId: string,
  promptId: string,
  patch: Partial<Pick<Prompt, "name" | "template">>,
) {
  update((s) => ({
    ...s,
    providers: s.providers.map((p) =>
      p.id === providerId
        ? {
            ...p,
            prompts: p.prompts.map((x) => (x.id === promptId ? { ...x, ...patch } : x)),
          }
        : p,
    ),
  }));
}

export function setDefaultProvider(providerId: string) {
  update((s) => ({ ...s, defaultProviderId: providerId }));
}

/** Reset the store to shipped defaults. Useful for a "reset to defaults" button
 *  in settings and for clearing test state. */
export function resetToDefaults() {
  const fresh = structuredClone(DEFAULTS);
  store.set(fresh);
  persist(fresh);
}

/** Assemble the final URL from a provider URL template, a prompt template,
 *  and the user's selected text. The two-step substitution must encode the
 *  inner result so things like `&`, `?`, `#` in the selection don't break the
 *  outer query. The provider template is expected to contain `{prompt}` once
 *  (validated on save). */
export function assembleUrl(
  providerUrlTemplate: string,
  promptTemplate: string,
  selection: string,
): string {
  const filledPrompt = promptTemplate.replace("{selection}", selection);
  return providerUrlTemplate.replace("{prompt}", encodeURIComponent(filledPrompt));
}

/** Convenience: look up provider + prompt by id and assemble. Returns null if
 *  either lookup fails (caller should treat as a no-op and surface nothing). */
export function assembleUrlByIds(
  providerId: string,
  promptId: string,
  selection: string,
): string | null {
  const s = get(store);
  const provider = s.providers.find((p) => p.id === providerId);
  if (!provider) return null;
  const prompt = provider.prompts.find((x) => x.id === promptId);
  if (!prompt) return null;
  return assembleUrl(provider.urlTemplate, prompt.template, selection);
}

export const aiLookup = {
  subscribe: store.subscribe,
};

// Ephemeral selection bridge between the contextmenu capture (in
// MarkdownRenderer) and the menu-event router (in +page.svelte). Not in the
// store because it's transient UI state, not persistent data. Cleared after
// each consumption so a stale selection can't leak into a later open.
let pendingSelection = "";

export function setPendingSelection(s: string) {
  pendingSelection = s;
}

export function consumePendingSelection(): string {
  const out = pendingSelection;
  pendingSelection = "";
  return out;
}
