export default function Loading() {
  return (
    <main
      id="main"
      className="page-wrap animate-pulse space-y-6"
      aria-label="불러오는 중"
    >
      <div className="h-10 w-64 rounded bg-muted" />
      <div className="h-80 rounded-xl bg-muted" />
    </main>
  );
}
