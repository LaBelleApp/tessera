// The Index view (sortable table over the same data).
export function setupTable(ctx) {
  const { FIELDS, STATES, NODES, nodeVisible, isStale, ago } = ctx;
  let sortKey = 'inDeg', sortDir = -1;

  function renderTable() {
    const rows = NODES.filter(nodeVisible).slice().sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (['name', 'type', 'status', 'owner'].includes(sortKey)) return sortDir * ('' + va).localeCompare('' + vb);
      if (sortKey === 'updated') return sortDir * (new Date(a.updatedAt) - new Date(b.updatedAt));
      return sortDir * ((va || 0) - (vb || 0));
    });
    const th = (k, l) => `<th data-k="${k}">${l}${sortKey === k ? (sortDir < 0 ? ' ▾' : ' ▴') : ''}</th>`;
    let h = `<thead><tr>${th('name', 'Tessera')}${th('type', 'Field')}${th('status', 'State')}${th('owner', 'Owner')}<th>Tags</th><th>What it is</th><th>When to use</th>${th('inDeg', '◂ rely')}${th('score', 'Health')}${th('updated', 'Updated')}</tr></thead><tbody>`;
    if (!rows.length) h += `<tr class="empty-row"><td colspan="10">No tesserae match your filters.</td></tr>`;
    rows.forEach(n => {
      const t = FIELDS[n.type], s = STATES[n.status];
      h += `<tr data-go="${n.id}"><td><span class="name">${n.name}</span></td>
        <td><span class="pill" style="color:${t.raw};border-color:${t.raw}66">${t.label}</span></td>
        <td><span class="pill" style="color:${s.color};border-color:${s.color}66">${s.label}</span></td>
        <td style="color:var(--muted)">${n.owner}</td>
        <td class="tags-cell">${(n.tags && n.tags.length) ? n.tags.map(tg => `<span class="tag" data-tag="${tg}">${tg}</span>`).join('') : '<span class="empty">—</span>'}</td>
        <td class="summary"><span>${n.summary || '—'}</span></td><td class="use"><span>${n.use || '—'}</span></td>
        <td class="num">${n.inDeg || ''}</td><td class="num">${n._cp ? n._cp.score + '/5' : '—'}</td>
        <td class="num${isStale(n) ? ' stale' : ''}">${n.updatedAt ? ago(n.updatedAt) : '—'}</td></tr>`;
    });
    h += '</tbody>'; document.getElementById('table').innerHTML = h;
    const ic = document.getElementById('indexCount'); if (ic) ic.textContent = rows.length === NODES.length ? `${NODES.length} tesserae` : `${rows.length} of ${NODES.length} shown`;
    document.querySelectorAll('#table th[data-k]').forEach(th => th.onclick = () => {
      const k = th.dataset.k;
      if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = (k === 'inDeg' || k === 'updated' || k === 'score') ? -1 : 1; }
      renderTable();
    });
    document.querySelectorAll('#table tbody tr[data-go]').forEach(tr => tr.onclick = () => ctx.api.select(tr.dataset.go));
    document.querySelectorAll('#table [data-tag]').forEach(el => el.onclick = ev => { ev.stopPropagation(); ctx.api.searchTag(el.dataset.tag); });
  }

  ctx.api.renderTable = renderTable;
}
