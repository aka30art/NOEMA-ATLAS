import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const errors = [];
const dataset = (file) => {
  const value = read(file);
  if (!value || typeof value.schemaVersion !== "string" || !Array.isArray(value.items)) {
    errors.push(`${file}: expected { schemaVersion, items[] }`);
    return { items: [] };
  }
  const ids = new Set();
  for (const [index, item] of value.items.entries()) {
    if (!item || typeof item.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(item.id)) {
      errors.push(`${file}: item ${index} has an invalid stable id`);
      continue;
    }
    if (ids.has(item.id)) errors.push(`${file}: duplicate id "${item.id}"`);
    ids.add(item.id);
  }
  return value;
};

const prompts = dataset("data/prompts.json");
const domains = dataset("data/domains.json");
const collections = dataset("data/collections.json");
const materials = dataset("data/materials.json");
const effects = dataset("data/effects.json");
const styles = dataset("data/styles.json");
const workflows = dataset("data/workflows.json");

const domainIds = new Set(domains.items.map((item) => item.id));
const promptIds = new Set(prompts.items.map((item) => item.id));

for (const prompt of prompts.items) {
  for (const field of ["title", "description", "prompt", "domainId", "status", "visibility"]) {
    if (typeof prompt[field] !== "string" || !prompt[field].trim()) errors.push(`prompt ${prompt.id}: missing ${field}`);
  }
  if (!Array.isArray(prompt.tags) || prompt.tags.some((tag) => typeof tag !== "string")) errors.push(`prompt ${prompt.id}: tags must be a string array`);
  if (!Number.isInteger(prompt.version) || prompt.version < 1) errors.push(`prompt ${prompt.id}: version must be a positive integer`);
  if (!domainIds.has(prompt.domainId)) errors.push(`prompt ${prompt.id}: unknown domain "${prompt.domainId}"`);
  if (!["draft", "published", "archived"].includes(prompt.status)) errors.push(`prompt ${prompt.id}: invalid status`);
  if (!["public", "private"].includes(prompt.visibility)) errors.push(`prompt ${prompt.id}: invalid visibility`);
}
for (const domain of domains.items) {
  if (typeof domain.name !== "string" || !domain.name.trim()) errors.push(`domain ${domain.id}: missing name`);
  if (typeof domain.description !== "string") errors.push(`domain ${domain.id}: missing description`);
}
for (const collection of collections.items) {
  if (typeof collection.title !== "string" || !collection.title.trim()) errors.push(`collection ${collection.id}: missing title`);
  if (!Array.isArray(collection.promptIds)) errors.push(`collection ${collection.id}: promptIds must be an array`);
  else for (const id of collection.promptIds) if (!promptIds.has(id)) errors.push(`collection ${collection.id}: unknown prompt "${id}"`);
}
for (const [file, records] of [["materials", materials.items], ["effects", effects.items], ["styles", styles.items]]) {
  for (const item of records) {
    if (typeof item.title !== "string" || !item.title.trim()) errors.push(`${file} ${item.id}: missing title`);
    if (typeof item.description !== "string") errors.push(`${file} ${item.id}: missing description`);
  }
}
for (const workflow of workflows.items) {
  if (typeof workflow.title !== "string" || !workflow.title.trim()) errors.push(`workflow ${workflow.id}: missing title`);
  if (!Array.isArray(workflow.steps) || workflow.steps.length < 2) errors.push(`workflow ${workflow.id}: expected at least two steps`);
}

const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const loaderStart = app.indexOf("async function loadContent()");
const loaderEnd = app.indexOf("async function init()", loaderStart);
if (loaderStart < 0 || loaderEnd < 0) {
  errors.push("app.js: expected an async loadContent() runtime loader");
} else {
  const loader = app.slice(loaderStart, loaderEnd);
  for (const name of ["prompts", "domains", "collections", "materials", "effects", "styles", "workflows"]) {
    if (!loader.includes("\"" + name + "\"")) errors.push(`app.js: runtime loader is missing the ${name} dataset`);
  }
  if (!/new URL\(["\']\.\/data\/["\']\s*\+\s*name\s*\+\s*["\']\.json["\']\s*,\s*document\.baseURI\)/.test(loader)) {
    errors.push("app.js: datasets must resolve relative to document.baseURI for GitHub Pages project paths");
  }
}

if (errors.length) {
  console.error("NOEMA ATLAS content validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`NOEMA ATLAS content validation passed: ${prompts.items.length} prompts, ${domains.items.length} domains, ${collections.items.length} collections, ${materials.items.length + effects.items.length + styles.items.length} lab references, ${workflows.items.length} workflows.`);
