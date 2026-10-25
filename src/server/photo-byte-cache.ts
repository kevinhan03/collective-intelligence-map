/** Immutable Storage paths only. Callers MUST check current public visibility first. */
export class PhotoByteCache {
  private entries = new Map<string, { bytes: ArrayBuffer; expires: number }>();
  private bytes = 0;
  constructor(
    private maxBytes = 8 * 1024 * 1024,
    private ttl = 60_000,
  ) {}
  get(path: string) {
    const entry = this.entries.get(path);
    if (!entry) return;
    this.entries.delete(path);
    this.bytes -= entry.bytes.byteLength;
    if (entry.expires <= Date.now()) return;
    this.entries.set(path, entry);
    this.bytes += entry.bytes.byteLength;
    return entry.bytes;
  }
  set(path: string, bytes: ArrayBuffer) {
    const previous = this.entries.get(path);
    if (previous) this.bytes -= previous.bytes.byteLength;
    this.entries.delete(path);
    if (bytes.byteLength > this.maxBytes) return;
    this.entries.set(path, { bytes, expires: Date.now() + this.ttl });
    this.bytes += bytes.byteLength;
    while (this.bytes > this.maxBytes || this.entries.size > 128) {
      const key = this.entries.keys().next().value!;
      this.bytes -= this.entries.get(key)!.bytes.byteLength;
      this.entries.delete(key);
    }
  }
}
