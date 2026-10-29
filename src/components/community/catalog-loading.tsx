export function CatalogLoading() {
  return (
    <div role="status" aria-label="지도 목록 불러오는 중" className="py-6">
      <span className="sr-only">지도 목록을 불러오고 있어요.</span>
      <div aria-hidden="true" className="h-13 rounded-full bg-white/5" />
      <div aria-hidden="true" className="mt-7 h-52 rounded-3xl bg-white/5" />
    </div>
  );
}
