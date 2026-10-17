/** A cache belongs to one mounted map and one viewer, never to the server module. */
export type ResourceSnapshot<T> = {
  data: T | undefined;
  loading: boolean;
  error: string;
  updatedAt: number;
};
const empty: ResourceSnapshot<never> = {
  data: undefined,
  loading: false,
  error: "",
  updatedAt: 0,
};
type Entry = {
  snapshot: ResourceSnapshot<unknown>;
  listeners: Set<() => void>;
  request?: { controller: AbortController; promise: Promise<void> };
};
export class PlaceResourceCache {
  constructor(readonly identity = "") {}
  private entries = new Map<string, Entry>();
  private entry(key: string) {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { snapshot: empty, listeners: new Set() };
      this.entries.set(key, entry);
    }
    return entry;
  }
  snapshot<T>(key: string): ResourceSnapshot<T> {
    return this.entry(key).snapshot as ResourceSnapshot<T>;
  }
  subscribe(key: string, listener: () => void) {
    const entry = this.entry(key);
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
    };
  }
  private publish(entry: Entry, snapshot: ResourceSnapshot<unknown>) {
    entry.snapshot = snapshot;
    entry.listeners.forEach((notify) => notify());
  }
  update<T>(key: string, change: (previous: T | undefined) => T) {
    const entry = this.entry(key);
    // A read started before a confirmed mutation must not overwrite that mutation.
    entry.request?.controller.abort();
    entry.request = undefined;
    this.publish(entry, {
      ...entry.snapshot,
      loading: false,
      data: change(entry.snapshot.data as T | undefined),
    });
  }
  load<T>(
    key: string,
    fetcher: (signal: AbortSignal) => Promise<T>,
    options: {
      force?: boolean;
      merge?: (previous: T | undefined, incoming: T) => T;
    } = {},
  ): Promise<void> {
    const entry = this.entry(key);
    if (!options.force) {
      if (entry.request) return entry.request.promise;
      if (
        entry.snapshot.data !== undefined &&
        Date.now() - entry.snapshot.updatedAt < 30_000
      )
        return Promise.resolve();
    }
    entry.request?.controller.abort();
    const controller = new AbortController();
    this.publish(entry, { ...entry.snapshot, loading: true, error: "" });
    // Defer the fetcher so even synchronous errors take the normal failure path.
    const promise = Promise.resolve()
      .then(() => fetcher(controller.signal))
      .then((incoming) => {
        if (controller.signal.aborted) return;
        this.publish(entry, {
          data: options.merge
            ? options.merge(entry.snapshot.data as T | undefined, incoming)
            : incoming,
          loading: false,
          error: "",
          updatedAt: Date.now(),
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        this.publish(entry, {
          ...entry.snapshot,
          loading: false,
          error: error instanceof Error ? error.message : "불러오지 못했어요.",
        });
        throw error;
      })
      .finally(() => {
        if (entry.request?.controller === controller) entry.request = undefined;
      });
    entry.request = { controller, promise };
    return promise;
  }
  dispose() {
    for (const entry of this.entries.values()) {
      entry.request?.controller.abort();
      entry.request = undefined;
    }
  }
}
export const emptyResourceSnapshot = () => empty;
