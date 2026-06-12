// The mosaic: force-directed graph of tesserae (tiles + gold seams).
import { hexPath } from './util.js';
const d3 = window.d3;

export function setupGraph(ctx) {
  const { FIELDS, STATES, ICONS, EMBLEMS, NODES, LINKS, state, nodeVisible, isStale, adj, downstreamClosure } = ctx;

  const svg = d3.select('#svg'), stage = document.getElementById('stage');
  let W = stage.clientWidth, H = stage.clientHeight;

  const defs = svg.append('defs');
  defs.html(`
    <filter id="glowGold" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="glowTile" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="6"/></filter>
    <linearGradient id="seamGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c9913a"/><stop offset="0.5" stop-color="#ffd98a"/><stop offset="1" stop-color="#c9913a"/></linearGradient>`);

  const g = svg.append('g'), gBg = g.append('g'), gLink = g.append('g'), gNode = g.append('g');
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * W * 1.6 - W * 0.3, y = Math.random() * H * 1.6 - H * 0.3, r = 6 + Math.random() * 22;
    gBg.append('path').attr('d', hexPath(r)).attr('transform', `translate(${x},${y})`).attr('fill', 'none').attr('stroke', '#e8b04b').attr('stroke-width', 0.6).attr('opacity', 0.025 + Math.random() * 0.05);
  }

  const zoom = d3.zoom().scaleExtent([0.4, 3]).on('zoom', e => g.attr('transform', e.transform));
  svg.call(zoom).on('dblclick.zoom', null);

  const typeKeys = Object.keys(FIELDS), cols = Math.ceil(Math.sqrt(typeKeys.length)), anchor = {};
  typeKeys.forEach((t, i) => { anchor[t] = { x: (i % cols + 0.5) / cols, y: (Math.floor(i / cols) + 0.5) / Math.ceil(typeKeys.length / cols) }; });
  const ax = n => anchor[n.type].x * W, ay = n => anchor[n.type].y * H, radius = n => 10 + Math.sqrt(n.inDeg) * 6;

  function fitView(dur = 600) {
    const vis = NODES.filter(nodeVisible), list = vis.length ? vis : NODES;
    if (!list.length || list[0].x === undefined) return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    list.forEach(n => { const r = radius(n); x0 = Math.min(x0, n.x - r); x1 = Math.max(x1, n.x + r); y0 = Math.min(y0, n.y - r); y1 = Math.max(y1, n.y + r); });
    const w = x1 - x0 || 1, h = y1 - y0 || 1, pad = 70;
    const scale = Math.max(0.4, Math.min(2, Math.min((W - 2 * pad) / w, (H - 2 * pad) / h)));
    const tx = W / 2 - scale * (x0 + x1) / 2, ty = H / 2 - scale * (y0 + y1) / 2;
    svg.transition().duration(dur).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }
  function centerOnNode(n, scale = 1.3, dur = 600) {
    if (!n || n.x === undefined) return;
    const cx = document.getElementById('detail').classList.contains('open') ? (W - 350) / 2 : W / 2;
    svg.transition().duration(dur).call(zoom.transform, d3.zoomIdentity.translate(cx - scale * n.x, H / 2 - scale * n.y).scale(scale));
  }

  const sim = d3.forceSimulation(NODES)
    .force('link', d3.forceLink(LINKS).id(d => d.id).distance(78).strength(.25))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('x', d3.forceX(ax).strength(.18)).force('y', d3.forceY(ay).strength(.18))
    .force('collide', d3.forceCollide(d => radius(d) + 8)).on('tick', ticked);

  let linkSel = gLink.selectAll('line'), nodeSel = gNode.selectAll('g.tile');
  linkSel = gLink.selectAll('line').data(LINKS, d => d.source.id + '-' + d.target.id).enter().append('line')
    .attr('stroke', 'url(#seamGrad)').attr('stroke-linecap', 'round')
    .attr('stroke-dasharray', d => d.kind === 'part-of' ? '2 5' : null);
  const ent = gNode.selectAll('g.tile').data(NODES, d => d.id).enter().append('g').attr('class', 'tile').style('cursor', 'pointer')
    .call(d3.drag().on('start', (e, d) => { if (!e.active) sim.alphaTarget(.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; }).on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }))
    .on('click', (e, d) => { e.stopPropagation(); ctx.api.select(d.id); })
    .on('mouseenter', (e, d) => showTip(e, d)).on('mousemove', moveTip).on('mouseleave', hideTip);
  ent.append('path').attr('class', 'halo').attr('filter', 'url(#glowTile)');
  ent.append('path').attr('class', 'facet');
  ent.append('path').attr('class', 'sheen');
  // a clean inlaid glyph: EMBLEM types are filled solids, the rest are line glyphs
  ent.append('g').attr('class', 'glyph').attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round')
    .attr('stroke-width', d => EMBLEMS.has(d.type) ? 0 : 2)
    .attr('fill', d => EMBLEMS.has(d.type) ? '#0a1c28' : 'none').attr('stroke', d => EMBLEMS.has(d.type) ? 'none' : '#0a1c28').html(d => ICONS[d.type] || '');
  ent.append('path').attr('class', 'bezel').attr('fill', 'none');
  ent.append('circle').attr('class', 'stale-dot');
  ent.append('text').attr('class', 'lbl').attr('text-anchor', 'middle').attr('fill', '#d7e6ec').attr('font-size', '10.5px').attr('font-weight', '500').attr('paint-order', 'stroke').attr('stroke', '#06121a').attr('stroke-width', '3px').style('pointer-events', 'none');
  nodeSel = ent;

  function refresh() {
    const sel = state.selected;
    const impactSet = (sel && state.impact) ? downstreamClosure(sel) : null;
    const neigh = sel ? (state.impact ? impactSet : adj[sel]) : null;
    const hiNodes = sel ? (state.impact ? new Set([sel, ...impactSet]) : null) : null;
    let visCount = 0;
    nodeSel.each(function (d) {
      const vis = nodeVisible(d), t = FIELDS[d.type], s = STATES[d.status], r = radius(d);
      if (vis) visCount++;
      const isSel = sel === d.id, isNeigh = sel && neigh.has(d.id);
      let op = vis ? s.op : 0.06; if (sel && !isSel && !isNeigh) op = vis ? Math.min(op, 0.15) : 0.04;
      const el = d3.select(this), col = s.desat ? '#48586a' : t.raw;
      el.style('display', (vis || sel) ? null : 'none').style('opacity', op);
      el.select('.facet').attr('d', hexPath(r)).attr('fill', col).attr('fill-opacity', 0.9);
      el.select('.sheen').attr('d', hexPath(r * 0.62)).attr('transform', `translate(0,${-r * 0.22})`).attr('fill', '#fff').attr('fill-opacity', state.icons ? 0.10 : 0.16);
      el.select('.halo').attr('d', hexPath(r + ((s.glow || isSel) ? 7 : 3))).attr('fill', col).attr('opacity', (s.glow || isSel) ? 0.5 : 0.18);
      const gs = (r * 1.15) / 24, ox = -12 * gs, oy = -12 * gs;
      el.select('.glyph').attr('transform', `translate(${ox},${oy}) scale(${gs})`).style('display', state.icons ? null : 'none').attr('opacity', EMBLEMS.has(d.type) ? 0.48 : 0.55);
      el.select('.bezel').attr('d', hexPath(r)).attr('stroke', isSel ? '#ffd98a' : '#e8b04b').attr('stroke-width', isSel ? 2.4 : 1.4)
        .attr('stroke-dasharray', s.dashed ? '3 3' : null).attr('filter', isSel ? 'url(#glowGold)' : null);
      el.select('.stale-dot').attr('cx', r * 0.6).attr('cy', -r * 0.66).attr('r', 3).attr('fill', 'var(--stale)').attr('stroke', '#06121a').attr('stroke-width', 1).style('display', isStale(d) ? null : 'none');
      el.select('.lbl').attr('y', r + 14).text(d.name.length > 20 ? d.name.slice(0, 19) + '…' : d.name).style('display', (r > 12 || isSel || isNeigh) ? null : 'none');
    });
    linkSel.each(function (l) {
      const visL = nodeVisible(l.source) && nodeVisible(l.target); let op, w, on;
      if (sel) { on = state.impact ? (hiNodes.has(l.source.id) && hiNodes.has(l.target.id)) : (l.source.id === sel || l.target.id === sel); op = on ? 0.95 : 0.05; w = on ? 2 : 1; }
      else { op = visL ? 0.22 : 0.03; w = 1; on = false; }
      d3.select(this).attr('opacity', op).attr('stroke-width', w).attr('filter', on ? 'url(#glowGold)' : null);
    });
    document.getElementById('emptyMosaic').style.display = (ctx.curView === 'mosaic' && visCount === 0) ? 'block' : 'none';
  }
  function ticked() {
    linkSel.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
  }
  svg.on('click', () => ctx.api.select(null));

  const tip = document.getElementById('tooltip');
  function showTip(e, d) { tip.textContent = d.name + ' — ' + STATES[d.status].label + (isStale(d) ? ' · stale' : ''); tip.style.opacity = 1; moveTip(e); }
  function moveTip(e) { tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY + 12) + 'px'; }
  function hideTip() { tip.style.opacity = 0; }

  window.addEventListener('resize', () => {
    W = stage.clientWidth; H = stage.clientHeight;
    sim.force('x', d3.forceX(ax).strength(.18)).force('y', d3.forceY(ay).strength(.18));
    sim.alpha(.4).restart(); setTimeout(() => fitView(), 650);
  });

  ctx.api.refresh = refresh;
  ctx.api.fitView = fitView;
  ctx.api.centerOnNode = centerOnNode;
  ctx.api.settle = () => { sim.stop(); sim.tick(260); ticked(); };
}
