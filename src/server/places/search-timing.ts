import "server-only";
export class SearchTiming {
  private started = performance.now();
  private durations: Record<string, number> = {};
  async measure<T>(stage: string, run: () => PromiseLike<T>): Promise<T> {
    const start = performance.now();
    try {
      return await run();
    } finally {
      this.durations[stage] = Math.round(performance.now() - start);
    }
  }
  finish(ok: boolean) {
    console.info("proposal_search_timing", {
      ok,
      ...this.durations,
      total: Math.round(performance.now() - this.started),
    });
  }
}
