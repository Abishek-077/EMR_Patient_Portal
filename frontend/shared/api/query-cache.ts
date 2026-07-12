type QueryLoader<T> = (context: { signal: AbortSignal }) => Promise<T>;

type CacheEntry<T> = {
  data?: T;
  expiresAt: number;
  promise?: Promise<T>;
  controller?: AbortController;
};

export type QueryOptions = {
  staleTimeMs?: number;
  retries?: number;
};

class QueryCache {
  private entries = new Map<string, CacheEntry<unknown>>();

  query<T>(keyParts: Array<string | number | boolean>, loader: QueryLoader<T>, options: QueryOptions = {}) {
    const key = serializeKey(keyParts);
    const now = Date.now();
    const current = this.entries.get(key) as CacheEntry<T> | undefined;
    if (current?.data !== undefined && current.expiresAt > now) return Promise.resolve(current.data);
    if (current?.promise) return current.promise;

    const controller = new AbortController();
    const entry: CacheEntry<T> = current || { expiresAt: 0 };
    entry.controller = controller;
    entry.promise = retryQuery(loader, controller.signal, options.retries ?? 1)
      .then((data) => {
        entry.data = data;
        entry.expiresAt = Date.now() + (options.staleTimeMs ?? 15_000);
        return data;
      })
      .finally(() => {
        entry.promise = undefined;
        entry.controller = undefined;
      });
    this.entries.set(key, entry);
    return entry.promise;
  }

  invalidate(prefixParts: Array<string | number | boolean>) {
    const prefix = serializeKey(prefixParts);
    for (const [key, entry] of this.entries) {
      if (key === prefix || key.startsWith(`${prefix}|`)) {
        entry.controller?.abort();
        this.entries.delete(key);
      }
    }
  }

  clear() {
    for (const entry of this.entries.values()) entry.controller?.abort();
    this.entries.clear();
  }
}

async function retryQuery<T>(loader: QueryLoader<T>, signal: AbortSignal, retries: number) {
  let attempt = 0;
  while (true) {
    try {
      return await loader({ signal });
    } catch (error) {
      if (signal.aborted || attempt >= retries || !isRetryable(error)) throw error;
      attempt += 1;
    }
  }
}

function isRetryable(error: unknown) {
  if (!(error instanceof Error)) return true;
  const status = Number((error as Error & { status?: number }).status || 0);
  return !status || status >= 500;
}

function serializeKey(parts: Array<string | number | boolean>) {
  return parts.map((part) => encodeURIComponent(String(part))).join('|');
}

export const queryCache = new QueryCache();
