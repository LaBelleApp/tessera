// validate.mjs — validate a parsed tessera manifest against the taxonomy.
// Usable as a library (validateManifest) and as a CLI:  node scripts/validate.mjs <file.yaml>
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import yaml from 'js-yaml';

const REQUIRED = ['id', 'name', 'type', 'status', 'owner', 'summary', 'whenToUse'];
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function loadTaxonomy(root = '.') {
  const tax = JSON.parse(fs.readFileSync(path.join(root, 'taxonomy.json'), 'utf8'));
  return {
    fields: new Set(tax.fields.map(f => f.key)),
    states: new Set(tax.states.map(s => s.key)),
    raw: tax,
  };
}

// Returns { ok, errors: string[], warnings: string[] }
export function validateManifest(m, taxonomy) {
  const errors = [], warnings = [];
  if (!m || typeof m !== 'object') return { ok: false, errors: ['manifest is empty or not an object'], warnings };

  for (const k of REQUIRED) {
    if (m[k] === undefined || m[k] === null || m[k] === '') errors.push(`missing required field: ${k}`);
  }
  if (m.id && !ID_RE.test(m.id)) errors.push(`id "${m.id}" must be kebab-case (a-z, 0-9, dashes)`);
  if (m.type && !taxonomy.fields.has(m.type)) errors.push(`unknown type "${m.type}" (not in taxonomy.fields)`);
  if (m.status && !taxonomy.states.has(m.status)) errors.push(`unknown status "${m.status}" (not in taxonomy.states)`);

  if (m.uses !== undefined && !Array.isArray(m.uses)) errors.push('uses must be a list');
  if (m.tags !== undefined && !Array.isArray(m.tags)) errors.push('tags must be a list');
  if (m.partOf !== undefined && m.partOf !== null && typeof m.partOf !== 'string')
    errors.push('partOf must be a single id or null');
  if (m.links !== undefined && (typeof m.links !== 'object' || Array.isArray(m.links)))
    errors.push('links must be an object (repo/doc/demo)');

  return { ok: errors.length === 0, errors, warnings };
}

// Cross-tile integrity: every uses/partOf target must resolve to a known id.
export function checkSeams(tesserae) {
  const ids = new Set(tesserae.map(t => t.id));
  const warnings = [];
  for (const t of tesserae) {
    for (const dep of t.uses || []) if (!ids.has(dep)) warnings.push(`${t.id} → uses unknown "${dep}"`);
    if (t.partOf && !ids.has(t.partOf)) warnings.push(`${t.id} → partOf unknown "${t.partOf}"`);
  }
  return warnings;
}

// ---- CLI ----
if (process.argv[1] === url.fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node scripts/validate.mjs <file.yaml>'); process.exit(2); }
  const taxonomy = loadTaxonomy('.');
  const m = yaml.load(fs.readFileSync(file, 'utf8'));
  const { ok, errors } = validateManifest(m, taxonomy);
  if (ok) { console.log(`✓ ${file} is valid`); process.exit(0); }
  console.error(`✗ ${file} has ${errors.length} error(s):`);
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
}
