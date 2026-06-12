// Tessera catalog access for the MCP server. Pure + testable: loads data.json
// (local path OR https URL via TESSERA_DATA), caches briefly, derives relations,
// and answers the queries the tools expose.
import fs from 'node:fs';

const TTL = 30_000; // re-read the source at most every 30s
let cache = { at: 0, data: null, src: null };
let taxCache = null;

const srcOf = () => process.env.TESSERA_DATA || 'docs/data.json';
const isUrl = s => /^https?:\/\//.test(s);
async function fetchJson(src) {
  return isUrl(src) ? await (await fetch(src)).json() : JSON.parse(fs.readFileSync(src, 'utf8'));
}

export async function loadCatalog() {
  const src = srcOf(), now = Date.now();
  if (cache.data && cache.src === src && now - cache.at < TTL) return cache.data;
  const raw = await fetchJson(src);
  const tesserae = raw.tesserae || [];
  const byId = Object.fromEntries(tesserae.map(t => [t.id, t]));
  const reliedOnBy = {}, dependsOn = {}, contains = {}, partOf = {};
  tesserae.forEach(t => { reliedOnBy[t.id] = []; dependsOn[t.id] = []; contains[t.id] = []; partOf[t.id] = []; });
  for (const t of tesserae) {
    (t.uses || []).forEach(u => { if (byId[u]) { dependsOn[t.id].push(u); reliedOnBy[u].push(t.id); } });
    if (t.partOf && byId[t.partOf]) { partOf[t.id].push(t.partOf); contains[t.partOf].push(t.id); }
  }
  const inDeg = {}; tesserae.forEach(t => inDeg[t.id] = reliedOnBy[t.id].length + contains[t.id].length);
  const data = { generatedAt: raw.generatedAt, stats: raw.stats || {}, tesserae, byId, rel: { reliedOnBy, dependsOn, contains, partOf }, inDeg, src };
  cache = { at: now, data, src };
  return data;
}

export async function loadTaxonomy() {
  if (taxCache) return taxCache;
  const taxSrc = process.env.TESSERA_TAXONOMY || srcOf().replace(/[^/]*$/, 'taxonomy.json');
  try { taxCache = await fetchJson(taxSrc); } catch { taxCache = { fields: [], states: [] }; }
  return taxCache;
}

const slim = t => ({ id: t.id, name: t.name, type: t.type, status: t.status, owner: t.owner, summary: t.summary, whenToUse: t.whenToUse, tags: t.tags || [], links: t.links || {} });

export async function search(query, { type, tag, limit = 20 } = {}) {
  const { tesserae, inDeg } = await loadCatalog();
  const q = (query || '').toLowerCase();
  const res = tesserae.filter(t => {
    if (type && t.type !== type) return false;
    if (tag && !(t.tags || []).includes(tag)) return false;
    if (!q) return true;
    const hay = (t.name + ' ' + t.id + ' ' + (t.summary || '') + ' ' + (t.whenToUse || '') + ' ' + (t.owner || '') + ' ' + (t.tags || []).join(' ')).toLowerCase();
    return hay.includes(q);
  });
  res.sort((a, b) => (inDeg[b.id] || 0) - (inDeg[a.id] || 0));
  return res.slice(0, limit).map(t => ({ ...slim(t), reliedOnByCount: inDeg[t.id] || 0 }));
}

export async function get(id) {
  const { byId, rel, inDeg } = await loadCatalog();
  const t = byId[id]; if (!t) return null;
  const ref = x => ({ id: x, name: (byId[x] && byId[x].name) || x, type: byId[x] && byId[x].type });
  return {
    ...t, reliedOnByCount: inDeg[id] || 0,
    dependsOn: rel.dependsOn[id].map(ref),
    partOf: rel.partOf[id].map(ref),
    reliedOnBy: rel.reliedOnBy[id].map(ref),
    contains: rel.contains[id].map(ref),
  };
}

export async function list(type) {
  const { tesserae } = await loadCatalog();
  return tesserae.filter(t => !type || t.type === type).map(slim);
}

// The stack a project is built on, so an agent can mirror the same standards.
export async function standards(id) {
  const { byId, rel } = await loadCatalog();
  const t = byId[id]; if (!t) return null;
  // transitive forward-dependency closure (everything it uses, recursively)
  const seen = new Set(), q = [...(rel.dependsOn[id] || [])];
  while (q.length) { const x = q.shift(); if (seen.has(x)) continue; seen.add(x); (rel.dependsOn[x] || []).forEach(y => q.push(y)); }
  const stack = [...seen].map(x => byId[x]).filter(Boolean).map(d => ({ id: d.id, name: d.name, type: d.type, summary: d.summary, links: d.links || {} }));
  const conventions = stack.concat([t]).filter(d => d.links && d.links.doc).map(d => ({ id: d.id, name: d.name, doc: d.links.doc }));
  return {
    project: { id: t.id, name: t.name, type: t.type, owner: t.owner, links: t.links || {} },
    directUses: (rel.dependsOn[id] || []).map(x => ({ id: x, name: byId[x].name, type: byId[x].type })),
    partOf: (rel.partOf[id] || []).map(x => ({ id: x, name: byId[x].name, type: byId[x].type })),
    stack,
    conventions,
    note: 'Tessera routes you to WHAT a project uses and WHERE the code lives. The actual conventions live in those repos — read the framework/template/doc links to mirror the standards.',
  };
}

export async function stats() {
  const { generatedAt, stats, tesserae } = await loadCatalog();
  const byType = {}, byState = {};
  tesserae.forEach(t => { byType[t.type] = (byType[t.type] || 0) + 1; byState[t.status] = (byState[t.status] || 0) + 1; });
  return { generatedAt, ...stats, total: tesserae.length, byType, byState, source: srcOf() };
}
