// Deliberate allowlist: never forward arbitrary DOM attributes, text or forms.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const values: Record<string, readonly string[]> = {
  entry: [
    "map_pin",
    "map_preview",
    "list",
    "deep_link",
    "detail",
    "home",
    "proposal",
    "comments",
    "map_focus",
  ],
  view: ["map", "list"],
  provider: ["google", "kakao", "maplibre", "preview"],
  sort: ["relevance", "distance", "newest", "popular", "saved"],
  status: ["pending", "approved", "rejected"],
};
export function publicEventProperties(input: Record<string, unknown>) {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "string") continue;
    if ((key === "map_id" || key === "place_id") && uuid.test(value))
      output[key] = value;
    else if (values[key]?.includes(value)) output[key] = value;
    else if (key === "control" && /^[a-z][a-z0-9_.-]{0,63}$/.test(value))
      output[key] = value;
  }
  return output;
}

const sdkKeys = new Set([
  "token",
  "distinct_id",
  "$device_id",
  "$session_id",
  "$window_id",
  "$lib",
  "$lib_version",
  "$browser",
  "$browser_version",
  "$os",
  "$os_version",
  "$device_type",
  "$screen_height",
  "$screen_width",
  "$viewport_height",
  "$viewport_width",
  "$is_identified",
  "$process_person_profile",
]);
export function sanitizedSdkProperties(
  input: Record<string, unknown>,
  url: string,
) {
  const output: Record<string, unknown> = { ...publicEventProperties(input) };
  for (const key of sdkKeys) {
    const value = input[key];
    if (
      typeof value === "boolean" ||
      typeof value === "number" ||
      (typeof value === "string" && value.length < 256)
    )
      output[key] = value;
  }
  if (input.$event_type === "click") {
    output.$event_type = "click";
    if (Array.isArray(input.$elements))
      output.$elements = input.$elements.slice(0, 12).map((element) => {
        const safe: Record<string, string | number> = {};
        if (!element || typeof element !== "object") return safe;
        if (
          typeof element.tag_name === "string" &&
          /^[a-z][a-z0-9-]{0,30}$/.test(element.tag_name)
        )
          safe.tag_name = element.tag_name;
        for (const key of ["nth_child", "nth_of_type"])
          if (Number.isInteger(element[key]) && element[key] > 0)
            safe[key] = element[key];
        return safe;
      });
  }
  output.$current_url = url;
  output.$pathname = new URL(url).pathname;
  return output;
}
