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
for (const file of ["data/materials.json", "data/effects.json", "data/styles.json", "data/workflows.json"]) dataset(file);

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
for (const collection of collections.items) {
  if (typeof collection.title !== "string" || !collection.title.trim()) errors.push(`collection ${collection.id}: missing title`);
  if (!Array.isArray(collection.promptIds)) errors.push(`collection ${collection.id}: promptIds must be an array`);
  else for (const id of collection.promptIds) if (!promptIds.has(id)) errors.push(`collection ${collection.id}: unknown prompt "${id}"`);
}
if (errors.length) {
  console.error("NOEMA ATLAS content validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`NOEMA ATLAS content validation passed: ${prompts.items.length} prompts, ${domains.items.length} domains, ${collections.items.length} collections.`);
