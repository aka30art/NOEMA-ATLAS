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
  for (const error of validate.errors || []) {
    errors.push(`${label}${error.instancePath || ""}: ${error.message}`);
  }
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

const domainIds = new Set(domains.items.map((item) => item.id));
const promptIds = new Set(prompts.items.map((item) => item.id));
const collectionIds = new Set(collections.items.map((item) => item.id));
const domainOrders = new Set();

for (const [index, prompt] of prompts.items.entries()) {
  if (!promptSchema(prompt)) reportSchemaErrors(`data/prompts.json item ${index}`, promptSchema);
  if (!domainIds.has(prompt.domainId)) errors.push(`prompt ${prompt.id}: unknown domain "${prompt.domainId}"`);
  for (const id of prompt.collectionIds || []) {
    const collection = collections.items.find((item) => item.id === id);
    if (!collection) errors.push(`prompt ${prompt.id}: unknown collection "${id}"`);
    else if (!(collection.promptIds || []).includes(prompt.id)) errors.push(`prompt ${prompt.id}: collection "${id}" is missing its reciprocal promptIds reference`);
  }
}
for (const [index, domain] of domains.items.entries()) {
  if (typeof domain.name !== "string" || !domain.name.trim()) errors.push(`domain ${domain.id}: missing name`);
  if (typeof domain.description !== "string" || !domain.description.trim()) errors.push(`domain ${domain.id}: missing description`);
  if (!Number.isInteger(domain.order) || domain.order < 1) errors.push(`domain ${domain.id}: order must be a positive integer`);
  else if (domainOrders.has(domain.order)) errors.push(`domain ${domain.id}: duplicate order ${domain.order}`);
  else domainOrders.add(domain.order);
}
for (const [index, collection] of collections.items.entries()) {
  if (!collectionSchema(collection)) reportSchemaErrors(`data/collections.json item ${index}`, collectionSchema);
  for (const id of collection.promptIds || []) {
    if (!promptIds.has(id)) errors.push(`collection ${collection.id}: unknown prompt "${id}"`);
    else if (!(prompts.items.find((prompt) => prompt.id === id)?.collectionIds || []).includes(collection.id)) errors.push(`collection ${collection.id}: prompt "${id}" is missing its reverse collectionIds reference`);
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
  if (!Array.isArray(workflow.steps) || workflow.steps.length < 2 || workflow.steps.some((step) => typeof step !== "string" || !step.trim())) {
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
  if (!/new URL\(["']\.\/data\/["']\s*\+\s*name\s*\+\s*["']\.json["']\s*,\s*document\.baseURI\)/.test(loader)) {
    errors.push("app.js: datasets must resolve relative to document.baseURI for GitHub Pages project paths");
  }
}

if (errors.length) {
  console.error("NOEMA ATLAS content validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`NOEMA ATLAS content validation passed: ${prompts.items.length} prompts, ${domains.items.length} domains, ${collections.items.length} collections, ${materials.items.length + effects.items.length + styles.items.length} schema-backed lab references, ${workflows.items.length} workflows.`);
