// The right-hand detail panel (Overview / Dependencies tabs).
export function setupDetail(ctx) {
  const { FIELDS, STATES, byId, state, dependsOn, partOfOf, reliedBy, contains, isStale, ago } = ctx;
  const detail = document.getElementById('detail');

  const badge = (c, t) => `<span class="badge" style="color:${c};border-color:${c}66;background:${c}14">${t}</span>`;
  const relItem = (id, dash) => { const n = byId[id]; return `<li data-go="${id}"><span class="seam${dash ? ' dash' : ''}"></span><span class="rel-name">${n.name}</span><span class="st">· ${STATES[n.status].label}</span></li>`; };

  function renderDetail(id) {
    const n = byId[id], t = FIELDS[n.type], s = STATES[n.status];
    const dep = dependsOn(id), po = partOfOf(id), rb = reliedBy(id), ct = contains(id), cp = n._cp;
    const relCount = dep.length + po.length + rb.length + ct.length;

    // --- Overview pane ---
    let gen = `<div class="field"><div class="lbl">What it is</div><div class="val">${n.summary || '<span style="color:var(--muted)">—</span>'}</div></div>
      <div class="field"><div class="lbl">When to use it</div><div class="val">${n.use || '<span style="color:var(--muted)">—</span>'}</div></div>
      <div class="field"><div class="lbl">Owner</div><div class="val">${n.owner}</div></div>`;
    if (cp) gen += `<div class="field"><div class="lbl">Completeness · ${cp.score}/5</div><div class="scorecard">${[['Owner', cp.checks[0]], ['Summary', cp.checks[1]], ['When to use', cp.checks[2]], ['Doc link', cp.checks[3]], ['Fresh', cp.checks[4]]].map(([lbl, ok]) => `<span class="sc ${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${lbl}</span>`).join('')}</div></div>`;
    if (n.tags && n.tags.length) gen += `<div class="field"><div class="lbl">Tags</div><div class="tagrow">${n.tags.map(x => `<span class="tag" data-tag="${x}">${x}</span>`).join('')}</div></div>`;
    const L = n.links || {}, lk = [];
    if (L.repo) lk.push(`<a href="${L.repo}" target="_blank" rel="noopener">↗ Repo</a>`);
    if (L.doc) lk.push(`<a href="${L.doc}" target="_blank" rel="noopener">↗ Docs</a>`);
    if (L.demo) lk.push(`<a href="${L.demo}" target="_blank" rel="noopener">↗ Demo</a>`);
    if (lk.length) gen += `<div class="field links">${lk.join('')}</div>`;
    gen += `<div class="meta-row"><span>Last updated</span><span style="${isStale(n) ? 'color:var(--stale)' : ''}">${n.updatedAt ? ago(n.updatedAt) : '—'}${isStale(n) ? ' · stale' : ''}</span></div>`;

    // --- Dependencies pane ---
    let deps = '';
    if (dep.length) deps += `<div class="field"><div class="lbl">Depends on</div><ul class="rel-list">${dep.map(x => relItem(x, false)).join('')}</ul></div>`;
    if (po.length) deps += `<div class="field"><div class="lbl">Part of</div><ul class="rel-list">${po.map(x => relItem(x, true)).join('')}</ul></div>`;
    if (rb.length) deps += `<div class="field"><div class="lbl">Relied on by · computed</div><ul class="rel-list">${rb.map(x => relItem(x, false)).join('')}</ul></div>`;
    if (ct.length) deps += `<div class="field"><div class="lbl">Contains · computed</div><ul class="rel-list">${ct.map(x => relItem(x, true)).join('')}</ul></div>`;
    if (!relCount) deps = `<div class="field"><div class="val" style="color:var(--muted)">No dependencies recorded for this tessera.</div></div>`;

    detail.innerHTML = `<button class="close">×</button>
      <div class="detail-head">
        <button class="go-mosaic" title="View on the mosaic"><svg viewBox="0 0 40 44" width="40" height="44"><defs><linearGradient id="gmF" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#143442"/><stop offset="1" stop-color="#0a1c28"/></linearGradient></defs><polygon points="20,2 38,12 38,32 20,42 2,32 2,12" fill="url(#gmF)" stroke="#ffd98a" stroke-width="2.4"/><polygon points="20,12 28,16.5 28,27.5 20,32 12,27.5 12,16.5" fill="#4fd6e0" opacity=".3" stroke="#4fd6e0" stroke-width="1.2"/><circle cx="20" cy="22" r="3.4" fill="#ffd98a"/></svg></button>
        <div class="head-text"><div class="kicker" style="color:${t.raw}">${t.label}</div><h2>${n.name}</h2><div class="id">${n.id}</div></div>
      </div>
      <div class="badges">${badge(s.color, '◆ ' + s.label)}${n.inDeg ? badge('#ffd98a', n.inDeg + ' rely on this') : ''}${isStale(n) ? badge('#ef6b5e', '● stale') : ''}</div>
      <div class="tabs">
        <button class="tab" data-tab="general">Overview</button>
        <button class="tab" data-tab="deps">Dependencies${relCount ? ` <span class="cnt">${relCount}</span>` : ''}</button>
      </div>
      <div class="tabpane" data-pane="general">${gen}</div>
      <div class="tabpane" data-pane="deps">${deps}</div>`;
    detail.classList.add('open');
    detail.querySelector('.close').onclick = () => select(null);
    const gm = detail.querySelector('.go-mosaic'); if (gm) gm.onclick = () => { ctx.api.setView('mosaic'); select(id); ctx.api.centerOnNode(byId[id]); };
    detail.querySelectorAll('[data-go]').forEach(li => li.onclick = () => select(li.dataset.go));
    detail.querySelectorAll('[data-tag]').forEach(el => el.onclick = () => ctx.api.searchTag(el.dataset.tag));
    const tabs = detail.querySelectorAll('.tab');
    const showTab = tb => { ctx.detailTab = tb; tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === tb)); detail.querySelectorAll('.tabpane').forEach(p => p.style.display = p.dataset.pane === tb ? '' : 'none'); };
    tabs.forEach(b => b.onclick = () => showTab(b.dataset.tab));
    showTab(ctx.detailTab);
  }

  function select(id) {
    state.selected = id;
    if (id) renderDetail(id); else detail.classList.remove('open');
    ctx.api.refresh(); ctx.api.renderTable(); ctx.api.writeHash();
  }

  ctx.api.renderDetail = renderDetail;
  ctx.api.select = select;
}
