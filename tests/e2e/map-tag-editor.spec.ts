import { expect, test, type Page } from "@playwright/test";
import { build } from "vite";
import { resolve } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { demoMap } from "../../src/server/demo";
let script = "",
  styles = "";
test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    resolve: {
      alias: {
        "@": resolve("src"),
        "next/navigation": resolve("tests/fixtures/map-tags-navigation.ts"),
      },
    },
    define: { "process.env.NODE_ENV": '"development"' },
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve("tests/fixtures/map-tags.tsx"),
        formats: ["iife"],
        name: "TagEditor",
      },
    },
    logLevel: "error",
  });
  const output = Array.isArray(result)
    ? result[0].output
    : "output" in result
      ? result.output
      : [];
  script = output
    .filter((x) => x.type === "chunk")
    .map((x) => (x.type === "chunk" ? x.code : ""))
    .join("\n");
  styles =
    readdirSync(".next-e2e/static/chunks")
      .filter((x) => x.endsWith(".css"))
      .map((x) => readFileSync(resolve(".next-e2e/static/chunks", x), "utf8"))
      .join("\n") +
    output
      .filter((x) => x.type === "asset" && x.fileName.endsWith(".css"))
      .map((x) => (x.type === "asset" ? String(x.source) : ""))
      .join("\n");
});
async function open(
  page: Page,
  role: string,
  options?: {
    tags: typeof demoMap.place_tags;
    tagIds: string[];
    loadFailures?: number;
  },
) {
  let tags = [...(options?.tags ?? demoMap.place_tags!)],
    tagIds = options?.tagIds ?? [tags[0].id];
  let loadFailures = options?.loadFailures ?? 0;
  const commands: Record<string, unknown>[] = [];
  await page.route("**/tag-editor*", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: `<html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body><main id="root"></main></body></html>`,
    }),
  );
  await page.route("**/api/maps/*/tags", async (r) => {
    const command = r.request().postDataJSON();
    commands.push(command);
    if (command.action === "create")
      tags.push({
        id: "aaaa5555-5555-4555-8555-555555555555",
        name: command.name,
      });
    if (command.action === "rename")
      tags = tags.map((t) =>
        t.id === command.id ? { ...t, name: command.name } : t,
      );
    if (command.action === "archive")
      tags = tags.filter((t) => t.id !== command.id);
    await r.fulfill({ json: { tags, canManage: true } });
  });
  await page.route("**/api/map-places/fixture/tags", async (r) => {
    if (r.request().method() === "GET" && loadFailures > 0) {
      loadFailures--;
      await r.fulfill({ status: 503, json: { error: "failed" } });
      return;
    }
    if (r.request().method() === "POST") {
      tagIds = r.request().postDataJSON().tagIds;
      commands.push({ action: "assign", tagIds });
    }
    await r.fulfill({ json: { tags, tagIds, canManage: role !== "visitor" } });
  });
  await page.goto(`/tag-editor?role=${role}`);
  await page.addScriptTag({ content: script });
  return commands;
}
for (const role of ["admin", "owner"]) {
  test(`${role} creates, renames, archives, and explicitly saves place tags`, async ({
    page,
  }) => {
    const commands = await open(page, role);
    const settings = page.getByRole("region", { name: "장소 분류 태그" });
    const name = page.getByRole("textbox", { name: "장소 태그 이름" });
    await name.fill("#혼밥");
    await name.press("Enter");
    await expect(settings.getByText("#혼밥", { exact: true })).toBeVisible();
    await settings.getByRole("button", { name: "혼밥 태그 이름 변경" }).click();
    await name.fill("#점심");
    await name.press("Enter");
    await expect(settings.getByText("#점심", { exact: true })).toBeVisible();
    await settings
      .getByRole("button", { name: "점심 태그 삭제", exact: true })
      .click();
    await settings
      .getByRole("button", { name: "태그 삭제", exact: true })
      .click();
    await expect(settings.getByText("#점심", { exact: true })).toHaveCount(0);
    const place = page.getByRole("region", { name: "이 지도의 태그" });
    await expect(place.getByText("편집숍", { exact: true })).toHaveCount(0);
    await expect(place.getByRole("button", { name: "태그 저장" })).toHaveCount(
      0,
    );
    await place.getByRole("button", { name: "분류 태그 수정" }).click();
    await place.getByRole("button", { name: "편집숍", exact: true }).click();
    expect(commands.some((c) => c.action === "assign")).toBe(false);
    await place.getByRole("button", { name: "태그 저장", exact: true }).click();
    await expect(page.locator("body")).toHaveAttribute("data-saved", "true");
    expect(commands.map((c) => c.action)).toEqual([
      "create",
      "rename",
      "archive",
      "assign",
    ]);
    expect(commands[0].name).toBe("혼밥");
    expect(commands[3].tagIds).toHaveLength(2);
    await expect(
      place.getByRole("form", { name: "분류 태그 편집" }),
    ).toHaveCount(0);
    await expect(place.getByText("편집숍", { exact: true })).toBeVisible();
    await expect(
      place.getByRole("button", { name: "분류 태그 수정" }),
    ).toBeFocused();
  });
}
test("visitors see assigned tags without management controls", async ({
  page,
}) => {
  await open(page, "visitor");
  await expect(
    page.getByRole("textbox", { name: "장소 태그 이름" }),
  ).toHaveCount(0);
  const place = page.getByRole("region", { name: "이 지도의 태그" });
  await expect(place.getByText("빈티지", { exact: true })).toBeVisible();
  await expect(place.getByText("편집숍", { exact: true })).toHaveCount(0);
  await expect(place.getByRole("button")).toHaveCount(0);
});

test("place-tag changes cancel without saving and Escape restores focus", async ({
  page,
}) => {
  const commands = await open(page, "admin");
  const place = page.getByRole("region", { name: "이 지도의 태그" });
  const edit = place.getByRole("button", { name: "분류 태그 수정" });
  await edit.click();
  await place.getByRole("button", { name: "편집숍", exact: true }).click();
  await place.getByRole("button", { name: "태그 수정 취소" }).click();
  await expect(edit).toBeFocused();
  await expect(place.getByText("편집숍", { exact: true })).toHaveCount(0);
  await edit.click();
  await expect(
    place.getByRole("button", { name: "편집숍", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Escape");
  await expect(edit).toBeFocused();
  expect(commands).toEqual([]);
});

test("place-tag save failure preserves draft and can be retried", async ({
  page,
}) => {
  const commands = await open(page, "admin");
  const place = page.getByRole("region", { name: "이 지도의 태그" });
  await place.getByRole("button", { name: "분류 태그 수정" }).click();
  await place.getByRole("button", { name: "편집숍", exact: true }).click();
  let fail = true;
  await page.route("**/api/map-places/fixture/tags", async (route) => {
    if (fail && route.request().method() === "POST") {
      fail = false;
      await route.fulfill({
        status: 503,
        json: { error: "저장에 실패했습니다." },
      });
    } else await route.fallback();
  });
  await place.getByRole("button", { name: "태그 저장" }).click();
  await expect(place.getByRole("alert")).toContainText("저장에 실패했습니다.");
  await expect(
    place.getByRole("button", { name: "편집숍", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await place.getByRole("button", { name: "태그 저장" }).click();
  await expect(place.getByRole("status")).toHaveText("태그를 저장했습니다.");
  expect(commands.filter((c) => c.action === "assign")).toHaveLength(1);
});

test("place-tag loading retries and empty assignments stay editable", async ({
  page,
}) => {
  await open(page, "admin", {
    tags: demoMap.place_tags!,
    tagIds: [],
    loadFailures: 1,
  });
  const place = page.getByRole("region", { name: "이 지도의 태그" });
  await expect(place.getByRole("alert")).toContainText(
    "장소 태그를 불러오지 못했습니다.",
  );
  await place.getByRole("button", { name: "다시 시도" }).click();
  await expect(place.getByText("아직 지정된 태그가 없습니다.")).toBeVisible();
  await place.getByRole("button", { name: "분류 태그 수정" }).click();
  await expect(place.getByRole("button", { name: "태그 저장" })).toBeDisabled();
  await place.getByRole("button", { name: "빈티지", exact: true }).click();
  await expect(place.getByRole("button", { name: "태그 저장" })).toBeEnabled();
});

test("place-tag editing enforces ten selections and wraps long names", async ({
  page,
}) => {
  const tags = Array.from({ length: 12 }, (_, i) => ({
    id: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    name: i === 11 ? "아주긴이름의분류태그입니다" : "태그" + i,
  }));
  await open(page, "admin", {
    tags,
    tagIds: tags.slice(1, 11).map((t) => t.id),
  });
  const place = page.getByRole("region", { name: "이 지도의 태그" });
  await place.getByRole("button", { name: "분류 태그 수정" }).click();
  await expect(
    place.getByRole("button", { name: "태그1", exact: true }),
  ).toBeFocused();
  await expect(
    place.getByRole("button", { name: "태그0", exact: true }),
  ).toBeDisabled();
  await place.getByRole("button", { name: "태그1", exact: true }).click();
  await expect(
    place.getByRole("button", { name: tags[11].name, exact: true }),
  ).toBeEnabled();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("switching map-place discards the previous map's unsaved tag draft", async ({
  page,
}) => {
  const commands = await open(page, "admin");
  const section = page.getByRole("region", { name: "이 지도의 태그" });
  await section.getByRole("button", { name: "분류 태그 수정" }).click();
  await section.getByRole("button", { name: "편집숍", exact: true }).click();
  await page.route("**/api/map-places/other-fixture/tags", (route) =>
    route.fulfill({
      json: {
        tags: [
          { id: "30000000-0000-4000-8000-000000000000", name: "수제맥주" },
        ],
        tagIds: ["30000000-0000-4000-8000-000000000000"],
        canManage: true,
      },
    }),
  );
  await page.getByRole("button", { name: "다른 지도 장소 보기" }).click();
  await expect(section.getByText("수제맥주", { exact: true })).toBeVisible();
  await expect(section.getByText("편집숍", { exact: true })).toHaveCount(0);
  await expect(section.getByRole("form")).toHaveCount(0);
  expect(commands).toEqual([]);
});
