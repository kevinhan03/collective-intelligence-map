/** Scoped to one mounted mobile list; never caches public visibility across visits. */
export function createThumbnailQueue() {
  type Job = {
    id: string;
    controller: AbortController;
    listeners: Set<(id: string | null) => void>;
  };
  const jobs = new Map<string, Job>();
  const waiting: Job[] = [];
  let running = 0;
  let disposed = false;
  function pump() {
    while (!disposed && running < 3 && waiting.length) {
      const job = waiting.shift()!;
      if (!job.listeners.size || job.controller.signal.aborted) continue;
      running++;
      void fetch(`/api/places/${encodeURIComponent(job.id)}/photos`, {
        signal: job.controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Photo unavailable");
          const data = await response.json();
          const id = data.photos?.[0]?.id;
          return typeof id === "string" ? id : null;
        })
        .catch(() => null)
        .then((id) => {
          if (!job.controller.signal.aborted)
            job.listeners.forEach((listener) => listener(id));
        })
        .finally(() => {
          running--;
          if (jobs.get(job.id) === job) jobs.delete(job.id);
          pump();
        });
    }
  }
  return {
    load(id: string, listener: (id: string | null) => void) {
      if (disposed) return () => {};
      let job = jobs.get(id);
      if (!job) {
        job = {
          id,
          controller: new AbortController(),
          listeners: new Set(),
        };
        jobs.set(id, job);
        waiting.push(job);
      }
      job.listeners.add(listener);
      pump();
      return () => {
        job.listeners.delete(listener);
        if (!job.listeners.size) {
          job.controller.abort();
          if (jobs.get(id) === job) jobs.delete(id);
        }
      };
    },
    dispose() {
      disposed = true;
      jobs.forEach((job) => job.controller.abort());
      jobs.clear();
      waiting.length = 0;
    },
  };
}
