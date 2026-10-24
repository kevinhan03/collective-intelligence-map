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
async function open(page: Page, role: string) {
  let tags = [...demoMap.place_tags!],
    tagIds = [tags[0].id];
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
    await place.getByRole("button", { name: "#편집숍", exact: true }).click();
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
  await expect(place.getByText("#빈티지", { exact: true })).toBeVisible();
  await expect(place.getByText("#편집숍", { exact: true })).toHaveCount(0);
  await expect(place.getByRole("button")).toHaveCount(0);
});
