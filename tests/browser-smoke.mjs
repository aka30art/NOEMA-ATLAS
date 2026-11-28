import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const file = path.resolve(root, "." + requestedPath);
  if (!file.startsWith(root + path.sep) && file !== path.join(root, "index.html")) {
    res.writeHead(403).end("Forbidden"); return;
  }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end("Not found"); return; }
    res.writeHead(200, { "content-type": mime[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

const listen = () => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(4173, "127.0.0.1", resolve);
});
await listen();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });

  await page.waitForFunction(() => document.querySelectorAll("#cards .card").length > 0);
  assert.equal(await page.title(), "NOEMA ATLAS");
  assert.equal(await page.locator("#domains .domain").count(), 8, "all domains render");
  assert.equal(await page.locator("#collections-home .collection").count(), 4, "all collections render");
  assert.equal(await page.locator("#cards .card").count(), 12, "all published prompts render");
  assert.equal(await page.locator("#lab-list .lab").count(), 30, "all creative lab references render");
  assert.match(await page.locator(".status").innerText(), /SYSTEM ONLINE/);

  const firstCard = page.locator("#cards .card").first();
  const firstTitle = await firstCard.locator("h3").innerText();
  await firstCard.locator("[data-open]").click();
  assert.equal(await page.locator("#detail-title").innerText(), firstTitle);
  assert.ok(await page.locator("#modal").evaluate(el => el.classList.contains("open")));
  await page.locator("#detail-save").click();
  await page.locator("#close").click();
  await page.locator('nav button[data-view="saved"]').click();
  assert.equal(await page.locator("#saved-list .card").count(), 1, "saved prompt persists in local storage");

  await page.locator('nav button[data-view="builder"]').click();
  assert.ok(await page.locator("#fields input").count() >= 5);
  assert.notEqual(await page.locator("#output").inputValue(), "");

  await page.locator("#search").fill("cinematic");
  await page.locator('nav button[data-view="library"]').click();
  const filteredCount = await page.locator("#cards .card").count();
  assert.ok(filteredCount > 0 && filteredCount < 12, "global search filters the prompt library");
  assert.deepEqual(pageErrors, [], "no uncaught browser errors");
  console.log("NOEMA ATLAS browser smoke passed: data rendering, prompt detail, save flow, builder, global search and zero page errors.");
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
