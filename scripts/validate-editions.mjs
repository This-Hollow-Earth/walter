// Validates public/data/editions.yaml + every referenced edition file (THI-105, spec A8).
// Usage: node scripts/validate-editions.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "public", "data");

const errors = [];
const warnings = [];

const manifest = yaml.load(readFileSync(join(dataDir, "editions.yaml"), "utf8"));
const seenIds = new Set();
for (const e of manifest.editions) {
  if (seenIds.has(e.id)) errors.push(`Duplicate edition id in manifest: ${e.id}`);
  seenIds.add(e.id);
}
// manifest order should be chronological: id like YYYY-qN, non-decreasing
let prevKey = "";
for (const e of manifest.editions) {
  const m = /^(\d{4})-q([1-4])$/.exec(e.id);
  if (!m) {
    warnings.push(`Edition id "${e.id}" doesn't match YYYY-qN — chronology check skipped for it.`);
    continue;
  }
  const key = `${m[1]}-${m[2]}`;
  if (key < prevKey) errors.push(`Manifest order is not chronological: ${e.id} comes after a later quarter.`);
  prevKey = key;
}

const editions = new Map();
for (const e of manifest.editions) {
  const path = join(dataDir, `${e.id}.yaml`);
  let data;
  try {
    data = yaml.load(readFileSync(path, "utf8"));
  } catch (err) {
    errors.push(`Could not read/parse ${e.id}.yaml: ${err.message}`);
    continue;
  }
  if (data.edition?.id !== e.id) errors.push(`${e.id}.yaml: edition.id "${data.edition?.id}" doesn't match manifest id "${e.id}"`);
  editions.set(e.id, data);
}

// per-edition structural checks
for (const [id, data] of editions) {
  const seenBlipIds = new Set();
  for (const b of data.blips ?? []) {
    if (seenBlipIds.has(b.id)) errors.push(`${id}.yaml: duplicate blip id ${b.id}`);
    seenBlipIds.add(b.id);
    if ((b.sources?.length ?? 0) < 2) warnings.push(`${id}.yaml: ${b.id} has fewer than 2 sources (editorial bar)`);
  }
}

// cross-edition checks: stable ids, first_edition matches real earliest appearance
const firstSeen = new Map(); // blipId -> edition id (chronological order as manifest lists them)
for (const e of manifest.editions) {
  const data = editions.get(e.id);
  if (!data) continue;
  for (const b of data.blips ?? []) {
    if (!firstSeen.has(b.id)) firstSeen.set(b.id, e.id);
  }
}
for (const [id, data] of editions) {
  for (const b of data.blips ?? []) {
    const declaredFirst = b.lifecycle?.first_edition;
    const actualFirst = firstSeen.get(b.id);
    if (declaredFirst && actualFirst && declaredFirst !== actualFirst) {
      errors.push(`${id}.yaml: ${b.id} lifecycle.first_edition="${declaredFirst}" but actually first appears in ${actualFirst}`);
    }
  }
}

// flag stray edition files not listed in the manifest
const manifestIds = new Set(manifest.editions.map((e) => e.id));
for (const f of readdirSync(dataDir)) {
  const m = /^(.+)\.yaml$/.exec(f);
  if (m && m[1] !== "editions" && !manifestIds.has(m[1])) {
    warnings.push(`${f} exists in public/data but is not listed in editions.yaml`);
  }
}

for (const w of warnings) console.warn("WARN:", w);
for (const e of errors) console.error("ERROR:", e);
console.log(`\n${editions.size} edition(s) checked, ${errors.length} error(s), ${warnings.length} warning(s).`);
if (errors.length) process.exit(1);
