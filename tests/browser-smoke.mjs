import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const basePath = "/NOEMA-ATLAS/";
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (!pathname.startsWith(basePath)) { res.writeHead(404).end("Not found"); return; }
  const relativePath = pathname.slice(basePath.length) || "index.html";
  const file = path.resolve(root, relativePath);
  if (file !== root && !file.startsWith(root + path.sep)) {
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
  const datasetResponses = new Map();
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.pathname.includes("/data/")) datasetResponses.set(url.pathname, response.status());
  });
  await page.goto("http://127.0.0.1:4173/NOEMA-ATLAS/", { waitUntil: "networkidle" });

  await page.waitForFunction(() => document.querySelectorAll("#cards .card").length > 0);
  assert.equal(await page.title(), "NOEMA ATLAS");
  assert.equal(await page.locator("#domains .domain").count(), 12, "all domains render");
  assert.equal(await page.locator("#collections-home .collection").count(), 6, "all collections render");
  assert.equal(await page.locator("#cards .card").count(), 36, "library renders one page of prompts");
  assert.equal(await page.locator("#count").innerText(), "2,400 MATCHING RECORDS", "all published prompts are indexed");
  assert.equal(await page.locator("#lab-list .lab").count(), 30, "all creative lab references render");
  assert.equal(await page.locator("#workflow-list .lab").count(), 4, "all workflows render");
  assert.equal(datasetResponses.size, 19, "all seven base datasets and twelve domain prompt datasets load");
  assert.ok([...datasetResponses].every(([url, status]) => url.startsWith("/NOEMA-ATLAS/data/") && status === 200), "datasets load from the GitHub Pages project path");
  assert.match(await page.locator(".status").innerText(), /SYSTEM ONLINE/);

  await page.locator('nav button[data-view="library"]').click();
  const domainValues = await page.locator("#domain option").evaluateAll(options => options.map(option => option.value).filter(value => value !== "all"));
  assert.equal(domainValues.length, 12, "all twelve domains are available");
  for (const domain of domainValues) {
    await page.locator("#domain").selectOption(domain);
    assert.equal(await page.locator("#count").innerText(), "200 MATCHING RECORDS", `${domain} has at least 200 published prompts`);
    assert.equal(await page.locator("#cards .card").count(), 36, `${domain} first page is paginated`);
  }
  await page.locator("#domain").selectOption("all");
  await page.locator("#pagination [data-page=\"next\"]").click();
  assert.match(await page.locator("#pagination .page-status").innerText(), /PAGE 2 \/ 67/);
  await page.locator("#pagination [data-page=\"previous\"]").click();
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
  assert.ok(filteredCount > 0 && filteredCount < 36, "global search filters the current prompt page");

  await page.locator("#search").fill("");
  await page.locator("#collection").selectOption("anime-cartoon");
  assert.equal(await page.locator("#cards .card").count(), 10, "specialist Anime & Cartoon collection filters correctly");
  await page.locator("#collection").selectOption("toys-collectibles");
  assert.equal(await page.locator("#cards .card").count(), 10, "specialist Toys & Collectibles collection filters correctly");
  assert.deepEqual(pageErrors, [], "no uncaught browser errors");
  console.log("NOEMA ATLAS browser smoke passed: data rendering, prompt detail, save flow, builder, global search and zero page errors.");
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
