import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = process.cwd();
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const errors = [];
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const contentSchema = ajv.compile(read("schemas/content.schema.json"));
const promptSchema = ajv.compile(read("schemas/prompt.schema.json"));
const collectionSchema = ajv.compile(read("schemas/collection.schema.json"));

function reportSchemaErrors(label, validate) {
  for (const error of validate.errors || []) errors.push(`${label}${error.instancePath || ""}: ${error.message}`);
}
const dataset = (file) => {
  const value = read(file);
  if (!contentSchema(value)) reportSchemaErrors(file, contentSchema);
  if (!value || !Array.isArray(value.items)) {
    errors.push(`${file}: expected a dataset envelope with items[]`);
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
const domainPromptSets = new Map();
for (const domain of domains.items) {
  domainPromptSets.set(domain.id, dataset(`data/prompts/${domain.id}.json`));
}
const allPrompts = [...prompts.items, ...[...domainPromptSets.values()].flatMap(set => set.items)];
const domainIds = new Set(domains.items.map(item => item.id));
const promptById = new Map();
const promptIds = new Set();
const titleKeys = new Set();
const bodyKeys = new Set();
const domainOrders = new Set();
const publishedCounts = new Map();

for (const [index, prompt] of allPrompts.entries()) {
  if (!promptSchema(prompt)) reportSchemaErrors(`prompt record ${prompt.id || index}`, promptSchema);
  if (promptIds.has(prompt.id)) errors.push(`duplicate prompt id across datasets: "${prompt.id}"`);
  promptIds.add(prompt.id);
  promptById.set(prompt.id, prompt);
  if (!domainIds.has(prompt.domainId)) errors.push(`prompt ${prompt.id}: unknown domain "${prompt.domainId}"`);
  if (prompt.status === "published" && prompt.visibility === "public") {
    publishedCounts.set(prompt.domainId, (publishedCounts.get(prompt.domainId) || 0) + 1);
  }
  const titleKey = String(prompt.title || "").trim().toLowerCase();
  if (titleKeys.has(titleKey)) errors.push(`duplicate prompt title: "${prompt.title}"`);
  titleKeys.add(titleKey);
  const bodyKey = String(prompt.prompt || "").toLowerCase().replace(/\\s+/g, " ").trim();
  if (bodyKeys.has(bodyKey)) errors.push(`duplicate prompt body: "${prompt.id}"`);
  bodyKeys.add(bodyKey);
  for (const id of prompt.collectionIds || []) {
    const collection = collections.items.find(item => item.id === id);
    if (!collection) errors.push(`prompt ${prompt.id}: unknown collection "${id}"`);
    else if (!(collection.promptIds || []).includes(prompt.id)) errors.push(`prompt ${prompt.id}: collection "${id}" is missing its reciprocal promptIds reference`);
  }
}
for (const [domainId, set] of domainPromptSets) {
  for (const prompt of set.items) {
    if (prompt.domainId !== domainId) errors.push(`data/prompts/${domainId}.json: prompt ${prompt.id} belongs to "${prompt.domainId}"`);
    if (prompt.status !== "published" || prompt.visibility !== "public") errors.push(`prompt ${prompt.id}: domain catalogue records must be published and public`);
    const wordCount = String(prompt.prompt || "").trim().split(/\\s+/).filter(Boolean).length;
    if (wordCount < 55) errors.push(`prompt ${prompt.id}: domain catalogue prompt is too short (${wordCount} words)`);
    if (!Array.isArray(prompt.tags) || prompt.tags.length < 3) errors.push(`prompt ${prompt.id}: expected at least three descriptive tags`);
  }
}
for (const domain of domains.items) {
  if (typeof domain.name !== "string" || !domain.name.trim()) errors.push(`domain ${domain.id}: missing name`);
  if (typeof domain.description !== "string" || !domain.description.trim()) errors.push(`domain ${domain.id}: missing description`);
  if (!Number.isInteger(domain.order) || domain.order < 1) errors.push(`domain ${domain.id}: order must be a positive integer`);
  else if (domainOrders.has(domain.order)) errors.push(`domain ${domain.id}: duplicate order ${domain.order}`);
  else domainOrders.add(domain.order);
  const count = publishedCounts.get(domain.id) || 0;
  if (count < 200) errors.push(`domain ${domain.id}: requires at least 200 published public prompts; found ${count}`);
}
for (const collection of collections.items) {
  if (!collectionSchema(collection)) reportSchemaErrors(`data/collections.json item ${collection.id}`, collectionSchema);
  for (const id of collection.promptIds || []) {
    if (!promptIds.has(id)) errors.push(`collection ${collection.id}: unknown prompt "${id}"`);
    else if (!(promptById.get(id)?.collectionIds || []).includes(collection.id)) errors.push(`collection ${collection.id}: prompt "${id}" is missing its reverse collectionIds reference`);
  }
}
for (const [file, records] of [["materials", materials.items], ["effects", effects.items], ["styles", styles.items]]) {
  for (const item of records) {
    if (typeof item.title !== "string" || !item.title.trim()) errors.push(`${file} ${item.id}: missing title`);
    if (typeof item.description !== "string" || !item.description.trim()) errors.push(`${file} ${item.id}: missing description`);
  }
}
for (const workflow of workflows.items) {
  if (typeof workflow.title !== "string" || !workflow.title.trim()) errors.push(`workflow ${workflow.id}: missing title`);
  if (!Array.isArray(workflow.steps) || workflow.steps.length < 2 || workflow.steps.some(step => typeof step !== "string" || !step.trim())) {
    errors.push(`workflow ${workflow.id}: expected at least two non-empty steps`);
  }
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
  if (!loader.includes('fetchItems("prompts/"+domain.id)')) errors.push("app.js: runtime loader is missing the per-domain prompt catalogue fetch");
  if (!loader.includes("domainPromptSets") || !loader.includes("allPromptItems")) errors.push("app.js: domain prompt datasets are not merged into the library");
  if (!/new URL\(["']\.\/data\/["']\s*\+\s*name\s*\+\s*["']\.json["']\s*,\s*document\.baseURI\)/.test(loader)) {
    errors.push("app.js: datasets must resolve relative to document.baseURI for GitHub Pages project paths");
  }
}
if (!app.includes("const PAGE_SIZE=36") || !app.includes("#pagination")) errors.push("app.js: prompt library pagination is missing");
if (errors.length) {
  console.error("NOEMA ATLAS content validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
const summary = domains.items.map(domain => `${domain.name} ${publishedCounts.get(domain.id) || 0}`).join(", ");
console.log(`NOEMA ATLAS content validation passed: ${allPrompts.length} prompts across ${domains.items.length} domains (minimum 200 each), ${collections.items.length} collections; counts: ${summary}.`);
