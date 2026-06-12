// Tessera — entry point. Loads ./taxonomy.json + ./data.json, builds the shared
// context, wires the modules together, and renders.
import { ICONS, EMBLEMS } from './icons.js';
import { lid, agoFrom } from './util.js';
import { setupGraph } from './graph.js';
import { setupDetail } from './detail.js';
import { setupTable } from './table.js';
import { setupFilters } from './filters.js';

const STALE_DAYS = 180;

async function boot() {
  const loading = document.getElementById('loading');
  if (location.protocol === 'file:') { loading.style.display = 'none'; document.getElementById('overlay').style.display = 'flex'; return; }
  let tax, data;
  try {
    [tax, data] = await Promise.all([
      fetch('./taxonomy.json').then(r => r.json()),
      fetch('./data.json').then(r => r.json()),
    ]);
  } catch (e) { loading.style.display = 'none'; document.getElementById('overlay').style.display = 'flex'; return; }

  const FIELDS = Object.fromEntries(tax.fields.map(f => [f.key, { label: f.label, color: f.color, raw: f.color }]));
  const STATES = Object.fromEntries(tax.states.map(s => [s.key, { label: s.label, op: s.brightness, color: s.color, dashed: !!s.dashed, glow: !!s.glow, desat: !!s.desat }]));
  const GENERATED_AT = new Date(data.generatedAt).getTime();
  const STATS = data.stats;
  const NODES = data.tesserae.map(t => ({
    id: t.id, name: t.name, type: t.type, status: t.status, owner: t.owner,
    summary: t.summary, use: t.whenToUse, uses: t.uses || [], partOf: t.partOf || null,
    tags: t.tags || [], links: t.links || {}, updatedAt: t.updatedAt,
  }));

  // graph data
  const byId = Object.fromEntries(NODES.map(n => [n.id, n]));
  const LINKS = [];
  NODES.forEach(n => {
    (n.uses || []).forEach(t => { if (byId[t]) LINKS.push({ source: n.id, target: t, kind: 'uses' }); });
    if (n.partOf && byId[n.partOf]) LINKS.push({ source: n.id, target: n.partOf, kind: 'part-of' });
  });
  const inDeg = {}; NODES.forEach(n => inDeg[n.id] = 0); LINKS.forEach(l => inDeg[l.target]++); NODES.forEach(n => n.inDeg = inDeg[n.id]);
  const reliedBy = id => LINKS.filter(l => lid(l.target) === id && l.kind === 'uses').map(l => lid(l.source));
  const contains = id => LINKS.filter(l => lid(l.target) === id && l.kind === 'part-of').map(l => lid(l.source));
  const dependsOn = id => LINKS.filter(l => lid(l.source) === id && l.kind === 'uses').map(l => lid(l.target));
  const partOfOf = id => LINKS.filter(l => lid(l.source) === id && l.kind === 'part-of').map(l => lid(l.target));
  const adj = {}; NODES.forEach(n => adj[n.id] = new Set());
  LINKS.forEach(l => { adj[l.source].add(l.target); adj[l.target].add(l.source); });
  const dependents = {}; NODES.forEach(n => dependents[n.id] = []);
  LINKS.forEach(l => { if (l.kind === 'uses') dependents[l.target].push(l.source); });
  const downstreamClosure = id => { const seen = new Set(), q = [id]; while (q.length) { const x = q.shift(); (dependents[x] || []).forEach(y => { if (!seen.has(y)) { seen.add(y); q.push(y); } }); } return seen; };

  // staleness + completeness
  const isStale = n => n.status !== 'fragment' && n.updatedAt && (GENERATED_AT - new Date(n.updatedAt).getTime()) > STALE_DAYS * 864e5;
  const completeness = n => {
    if (n.status === 'fragment') return null;
    const c = [!!n.owner && n.owner !== 'unassigned', !!n.summary, !!n.use, !!(n.links && n.links.doc), !isStale(n)];
    return { checks: c, score: c.filter(Boolean).length, total: 5 };
  };
  NODES.forEach(n => { const cp = completeness(n); n._cp = cp; n.score = cp ? cp.score : -1; });

  const state = { selected: null, visibleTypes: new Set(Object.keys(FIELDS)), visibleStatus: new Set(Object.keys(STATES)), query: '', icons: false, impact: false };
  const ago = iso => agoFrom(GENERATED_AT, iso);
  const nodeVisible = n => state.visibleTypes.has(n.type) && state.visibleStatus.has(n.status)
    && (!state.query || (n.name + ' ' + n.id + ' ' + n.summary + ' ' + n.owner + ' ' + (n.tags || []).join(' ')).toLowerCase().includes(state.query));

  // shared context + cross-module call registry
  const ctx = {
    FIELDS, STATES, ICONS, EMBLEMS, NODES, LINKS, byId, adj, dependents, downstreamClosure,
    GENERATED_AT, STATS, STALE_DAYS, state, curView: 'mosaic', detailTab: 'general',
    nodeVisible, isStale, completeness, ago, lid,
    dependsOn, partOfOf, reliedBy, contains,
    api: {},
  };

  setupGraph(ctx);
  setupDetail(ctx);
  setupTable(ctx);
  const { pendingView, pendingTile } = setupFilters(ctx);

  // global freshness + health line
  const frags = STATS.fragments ?? NODES.filter(n => n.status === 'fragment').length;
  const scored = NODES.filter(n => n._cp);
  const docPct = scored.length ? Math.round(100 * scored.reduce((a, n) => a + n._cp.score, 0) / (scored.length * 5)) : 0;
  document.getElementById('freshTxt').innerHTML = `Mosaic assembled <b style="color:var(--cyan)">${ago(new Date(GENERATED_AT).toISOString())}</b> · ${NODES.length} tesserae · ${frags} fragments · <b style="color:var(--cyan)">${docPct}%</b> documented`;

  // first render + restore shared state
  ctx.api.syncFilterUI();
  ctx.api.refresh(); ctx.api.renderTable();
  ctx.api.settle();
  ctx.api.setView(pendingView);
  if (pendingTile) { ctx.api.select(pendingTile); if (pendingView === 'mosaic') ctx.api.centerOnNode(byId[pendingTile]); else ctx.api.fitView(0); }
  else { ctx.api.fitView(0); }

  loading.style.display = 'none';
}
boot();
