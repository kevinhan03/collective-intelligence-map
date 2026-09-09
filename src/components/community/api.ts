export async function post<T = Record<string, unknown>>(
  url: string,
  data: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "요청을 처리하지 못했습니다.");
  return result;
}
