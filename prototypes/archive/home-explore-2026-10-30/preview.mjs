import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, "../../..");
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};
http
  .createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
      const relative = pathname === "/" ? "index.html" : pathname.slice(1);
      const base =
        relative === "suit.woff2"
          ? path.join(
              repo,
              "node_modules/@sun-typeface/suit/fonts/variable/woff2",
            )
          : /\.(jpe?g|webp)$/.test(relative)
            ? path.join(repo, "public")
            : root;
      const file = path.resolve(
        base,
        relative === "suit.woff2" ? "SUIT-Variable.woff2" : relative,
      );
      if (!file.startsWith(base + path.sep)) throw new Error("Invalid path");
      const body = await readFile(file);
      response.writeHead(200, {
        "Content-Type": `${types[path.extname(file)] ?? "application/octet-stream"}${/\.(html|css|js)$/.test(file) ? "; charset=utf-8" : ""}`,
        "Cache-Control": "no-store",
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  })
  .listen(3335, "127.0.0.1", () =>
    console.log("Ting Map prototype: http://localhost:3335"),
  );
