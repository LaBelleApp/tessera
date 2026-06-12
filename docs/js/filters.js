// Filters, view toggle, display toggles, URL hash and keyboard shortcuts.
export function setupFilters(ctx) {
  const { FIELDS, STATES, byId, state } = ctx;
  const searchEl = document.getElementById('search');

  // ---- URL hash (shareable state) ----
  function writeHash() {
    const p = new URLSearchParams();
    if (ctx.curView === 'index') p.set('view', 'index');
    if (state.selected) p.set('tile', state.selected);
    if (state.query) p.set('q', state.query);
    if (state.visibleTypes.size !== Object.keys(FIELDS).length) p.set('fields', [...state.visibleTypes].join(','));
    if (state.visibleStatus.size !== Object.keys(STATES).length) p.set('states', [...state.visibleStatus].join(','));
    if (state.impact) p.set('impact', '1');
    if (state.icons) p.set('icons', '1');
    const s = p.toString();
    history.replaceState(null, '', s ? ('#' + s) : (location.pathname + location.search));
  }
  let pendingView = 'mosaic', pendingTile = null;
  (function readHash() {
    const h = location.hash.replace(/^#/, ''); if (!h) return;
    const p = new URLSearchParams(h);
    if (p.get('fields')) state.visibleTypes = new Set(p.get('fields').split(',').filter(k => FIELDS[k]));
    if (p.get('states')) state.visibleStatus = new Set(p.get('states').split(',').filter(k => STATES[k]));
    if (p.get('q')) state.query = p.get('q').toLowerCase();
    state.impact = p.get('impact') === '1';
    state.icons = p.get('icons') === '1';
    pendingView = p.get('view') === 'index' ? 'index' : 'mosaic';
    pendingTile = (p.get('tile') && byId[p.get('tile')]) ? p.get('tile') : null;
  })();

  // ---- filter checkboxes ----
  const typeBox = document.getElementById('typeFilters');
  Object.entries(FIELDS).forEach(([k, v]) => {
    const l = document.createElement('label'); l.className = 'chk';
    l.innerHTML = `<input type="checkbox" data-type="${k}"><span class="hexmark" style="background:${v.color}"></span><span class="flabel">${v.label}</span><button type="button" class="focus" data-focus-type="${k}" title="Focus on ${v.label}">◎</button>`;
    typeBox.appendChild(l);
  });
  const statusBox = document.getElementById('statusFilters');
  Object.entries(STATES).forEach(([k, v]) => {
    const l = document.createElement('label'); l.className = 'chk';
    l.innerHTML = `<input type="checkbox" data-status="${k}"><span class="hexmark" style="background:${v.color}"></span><span class="flabel">${v.label}</span><button type="button" class="focus" data-focus-status="${k}" title="Focus on ${v.label}">◎</button>`;
    statusBox.appendChild(l);
  });
  typeBox.addEventListener('change', e => { const t = e.target.dataset.type; if (!t) return; e.target.checked ? state.visibleTypes.add(t) : state.visibleTypes.delete(t); ctx.api.refresh(); ctx.api.renderTable(); writeHash(); syncFilterUI(); });
  statusBox.addEventListener('change', e => { const s = e.target.dataset.status; if (!s) return; e.target.checked ? state.visibleStatus.add(s) : state.visibleStatus.delete(s); ctx.api.refresh(); ctx.api.renderTable(); writeHash(); syncFilterUI(); });
  typeBox.addEventListener('click', e => { const b = e.target.closest('.focus'); if (!b) return; e.preventDefault(); e.stopPropagation(); focusFilter('type', b.dataset.focusType); });
  statusBox.addEventListener('click', e => { const b = e.target.closest('.focus'); if (!b) return; e.preventDefault(); e.stopPropagation(); focusFilter('status', b.dataset.focusStatus); });

  searchEl.addEventListener('input', e => { state.query = e.target.value.toLowerCase().trim(); ctx.api.refresh(); ctx.api.renderTable(); writeHash(); });
  document.getElementById('filtersHead').onclick = () => document.getElementById('filters').classList.toggle('collapsed');

  // ---- display toggles ----
  const iconsToggle = document.getElementById('iconsToggle'), impactToggle = document.getElementById('impactToggle');
  iconsToggle.onclick = () => { state.icons = !state.icons; iconsToggle.classList.toggle('active', state.icons); ctx.api.refresh(); writeHash(); };
  impactToggle.onclick = () => { state.impact = !state.impact; impactToggle.classList.toggle('active', state.impact); ctx.api.refresh(); writeHash(); };

  // ---- select-all / deselect-all per group ----
  const typeAllBtn = document.querySelector('.toggle-all[data-group="type"]');
  const statusAllBtn = document.querySelector('.toggle-all[data-group="status"]');
  function setAll(group, on) {
    if (group === 'type') state.visibleTypes = on ? new Set(Object.keys(FIELDS)) : new Set();
    else state.visibleStatus = on ? new Set(Object.keys(STATES)) : new Set();
    syncFilterUI(); ctx.api.refresh(); ctx.api.renderTable(); ctx.api.fitView(); writeHash();
  }
  typeAllBtn.onclick = () => setAll('type', state.visibleTypes.size !== Object.keys(FIELDS).length);
  statusAllBtn.onclick = () => setAll('status', state.visibleStatus.size !== Object.keys(STATES).length);

  function syncFilterUI() {
    typeBox.querySelectorAll('input[data-type]').forEach(i => i.checked = state.visibleTypes.has(i.dataset.type));
    statusBox.querySelectorAll('input[data-status]').forEach(i => i.checked = state.visibleStatus.has(i.dataset.status));
    iconsToggle.classList.toggle('active', state.icons); impactToggle.classList.toggle('active', state.impact); searchEl.value = state.query;
    typeAllBtn.textContent = state.visibleTypes.size === Object.keys(FIELDS).length ? 'None' : 'All';
    statusAllBtn.textContent = state.visibleStatus.size === Object.keys(STATES).length ? 'None' : 'All';
  }
  function focusFilter(dim, key) {
    if (dim === 'type') { state.visibleTypes = new Set([key]); state.visibleStatus = new Set(Object.keys(STATES)); }
    else { state.visibleStatus = new Set([key]); state.visibleTypes = new Set(Object.keys(FIELDS)); }
    state.query = ''; searchEl.value = '';
    syncFilterUI(); setView('mosaic'); ctx.api.refresh(); ctx.api.renderTable(); ctx.api.fitView(); writeHash();
  }
  function searchTag(tag) { searchEl.value = tag; state.query = String(tag).toLowerCase(); ctx.api.refresh(); ctx.api.renderTable(); writeHash(); }

  // ---- view toggle ----
  const btnM = document.getElementById('btnMosaic'), btnI = document.getElementById('btnIndex');
  function setView(v) {
    const idx = v === 'index'; ctx.curView = idx ? 'index' : 'mosaic';
    document.getElementById('tableWrap').classList.toggle('show', idx);
    document.getElementById('stage').style.display = idx ? 'none' : 'block';
    document.getElementById('filters').style.display = idx ? 'none' : 'flex';
    document.getElementById('viewctrls').style.display = idx ? 'none' : 'flex';
    document.getElementById('freshness').style.display = idx ? 'none' : 'flex';
    document.getElementById('emptyMosaic').style.display = 'none';
    btnI.classList.toggle('active', idx); btnM.classList.toggle('active', !idx);
    if (idx) ctx.api.renderTable(); else ctx.api.refresh();
    writeHash();
  }
  btnM.onclick = () => setView('mosaic'); btnI.onclick = () => setView('index');

  // ---- keyboard shortcuts ----
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (e.key === '/' && tag !== 'input') { e.preventDefault(); searchEl.focus(); return; }
    if (e.key === 'Escape') { if (state.selected) ctx.api.select(null); else if (state.query) { searchEl.value = ''; state.query = ''; ctx.api.refresh(); ctx.api.renderTable(); writeHash(); } searchEl.blur(); return; }
    if (tag === 'input') return;
    if (e.key === 'm' || e.key === 'M') setView('mosaic');
    if (e.key === 'i' || e.key === 'I') setView('index');
  });

  ctx.api.writeHash = writeHash;
  ctx.api.syncFilterUI = syncFilterUI;
  ctx.api.focusFilter = focusFilter;
  ctx.api.searchTag = searchTag;
  ctx.api.setView = setView;
  return { pendingView, pendingTile };
}
