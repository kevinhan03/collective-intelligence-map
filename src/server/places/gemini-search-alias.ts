import "server-only";
import { serviceDb } from "@/lib/supabase/admin";
import { HttpError } from "@/server/http";

const JAPANESE = /[\u3040-\u30ff\u3400-\u9fff]/;
const LATIN_QUERY = /^[\p{Script=Latin}\p{Number}\s&'.,/()\-]+$/u;

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

function normalize(query: string) {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function shouldTranslate(query: string, country: string) {
  return country === "JP" && !JAPANESE.test(query) && LATIN_QUERY.test(query);
}

function cleanAliases(value: unknown, original: string) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(
      (item) =>
        item.length >= 2 &&
        item.length <= 100 &&
        JAPANESE.test(item) &&
        item.toLocaleLowerCase("en-US") !== original,
    )
    .filter((item) => {
      const key = item.toLocaleLowerCase("ja-JP");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

async function generateJapaneseQueries(query: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError("일본어 검색 보조가 아직 준비되지 않았습니다. 일본어 이름으로 검색하거나 직접 등록해 주세요.", 503);
  const model = process.env.GEMINI_SEARCH_MODEL ?? "gemini-flash-latest";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Convert this English place-search query for Japan into up to 4 Japanese queries that could match a place name. Preserve a brand name when it is clearly a brand. Do not invent a place, address, or description. Return only JSON. Query: ${query}`,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 512,
          temperature: 0,
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: { queries: { type: "array", items: { type: "string" } } },
            required: ["queries"],
          },
        },
      }),
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!response.ok) throw new Error(`Gemini search alias request failed: ${response.status}`);
  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return [];
  const parsed: unknown = JSON.parse(text);
  return cleanAliases(
    typeof parsed === "object" && parsed !== null && "queries" in parsed
      ? (parsed as { queries?: unknown }).queries
      : undefined,
    normalize(query),
  );
}

/** Returns cached Japanese fallback queries, generating them only on a cache miss. */
export async function japaneseSearchAliases(query: string, country: string, userId?: string) {
  const normalizedQuery = normalize(query);
  if (!shouldTranslate(normalizedQuery, country)) return [];
  const client = serviceDb();
  const { data: cached, error } = await client
    .from("search_query_aliases")
    .select("japanese_queries,updated_at")
    .eq("country_code", country)
    .eq("normalized_query", normalizedQuery)
    .maybeSingle();
  if (error) {
    console.error("gemini_alias_cache_read_failed", error.code);
    throw new HttpError("일본어 검색 보조에 연결하지 못했습니다. 잠시 후 다시 검색해 주세요.", 503);
  }
  if (cached && Date.now() - Date.parse(cached.updated_at) < 30 * 86400000)
    return cached.japanese_queries;

  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("Gemini key missing");
    if (!userId) throw new Error("Search user missing");
    const { data: allowed, error: limitError } = await client.rpc("reserve_search_operation", { u: userId, operation: "gemini" });
    if (limitError) throw new Error("Search reservation failed");
    if (!allowed) throw new HttpError("일본어 검색 보조 요청이 많습니다. 잠시 후 다시 시도하거나 일본어 이름으로 검색해 주세요.", 429);
    const aliases = await generateJapaneseQueries(normalizedQuery);
    const { error: writeError } = await client.from("search_query_aliases").upsert(
      {
        country_code: country,
        normalized_query: normalizedQuery,
        japanese_queries: aliases,
        generator: "gemini",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "country_code,normalized_query" },
    );
    if (writeError) console.error("gemini_alias_cache_write_failed", writeError.code);
    return aliases;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("gemini_alias_generation_failed", error instanceof Error ? error.name : "unknown");
    throw new HttpError("일본어 검색 보조가 일시적으로 응답하지 않습니다. 잠시 후 다시 검색하거나 직접 등록해 주세요.", 503);
  }
}
