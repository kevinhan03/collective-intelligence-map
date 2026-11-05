import { PHOTO_PREVIEW_BATCH_LIMIT } from "@/domain/place-photo";

/** Scoped to one mounted mobile list; never caches public visibility across visits. */
export function createThumbnailQueue() {
  type Job = {
    id: string;
    listeners: Set<(id: string | null) => void>;
    batch?: Batch;
  };
  type Batch = { jobs: Job[]; controller: AbortController };
  const jobs = new Map<string, Job>();
  const waiting = new Set<Job>();
  const active = new Set<Batch>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function schedule() {
    if (disposed || timer !== undefined || !waiting.size || active.size >= 2)
      return;
    timer = setTimeout(() => {
      timer = undefined;
      pump();
    }, 16);
  }
  function pump() {
    while (!disposed && active.size < 2 && waiting.size) {
      const selected = [...waiting].slice(0, PHOTO_PREVIEW_BATCH_LIMIT);
      const batch: Batch = {
        jobs: selected,
        controller: new AbortController(),
      };
      for (const job of selected) {
        waiting.delete(job);
        job.batch = batch;
      }
      active.add(batch);
      void fetch("/api/places/photos/previews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeIds: selected.map((job) => job.id) }),
        signal: batch.controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Photo unavailable");
          const data = await response.json();
          return data.previews as Record<string, unknown>;
        })
        .catch(() => null)
        .then((previews) => {
          if (disposed || batch.controller.signal.aborted) return;
          for (const job of selected) {
            const value = previews?.[job.id];
            const id = typeof value === "string" ? value : null;
            // Remove before callbacks so reentrant loads get a new job.
            if (jobs.get(job.id) === job) jobs.delete(job.id);
            for (const listener of [...job.listeners]) {
              if (disposed || batch.controller.signal.aborted) return;
              if (job.listeners.has(listener)) listener(id);
            }
            job.listeners.clear();
          }
        })
        .finally(() => {
          active.delete(batch);
          for (const job of selected)
            if (jobs.get(job.id) === job) jobs.delete(job.id);
          schedule();
        });
    }
  }
  return {
    load(id: string, listener: (id: string | null) => void) {
      if (disposed) return () => {};
      let job = jobs.get(id);
      if (!job) {
        job = { id, listeners: new Set() };
        jobs.set(id, job);
        waiting.add(job);
      }
      job.listeners.add(listener);
      schedule();
      return () => {
        job.listeners.delete(listener);
        if (job.listeners.size) return;
        waiting.delete(job);
        if (jobs.get(id) === job) jobs.delete(id);
        const batch = job.batch;
        if (batch && batch.jobs.every((item) => !item.listeners.size))
          batch.controller.abort();
      };
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      for (const batch of active) batch.controller.abort();
      for (const job of jobs.values()) job.listeners.clear();
      jobs.clear();
      waiting.clear();
    },
  };
}
