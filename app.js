const STORAGE_KEY = 'stockCountAppData_v1';

const els = {
  counterName: document.getElementById('counterName'),
  stockCountId: document.getElementById('stockCountId'),
  siteId: document.getElementById('siteId'),
  status: document.getElementById('status'),
  countDate: document.getElementById('countDate'),
  startTime: document.getElementById('startTime'),
  newSessionBtn: document.getElementById('newSessionBtn'),
  saveSessionBtn: document.getElementById('saveSessionBtn'),
  csvFile: document.getElementById('csvFile'),
  itemsTableBody: document.querySelector('#itemsTable tbody'),
  rowTemplate: document.getElementById('rowTemplate'),
  addRowBtn: document.getElementById('addRowBtn'),
  sessionsList: document.getElementById('sessionsList'),
  sessionSearch: document.getElementById('sessionSearch'),
  quickFilter: document.getElementById('quickFilter'),
  worksheetMeta: document.getElementById('worksheetMeta'),
  exportSessionBtn: document.getElementById('exportSessionBtn'),
  exportAllBtn: document.getElementById('exportAllBtn'),
  clearAllBtn: document.getElementById('clearAllBtn')
};

let appState = loadState();
let currentSessionId = null;

init();

function init() {
  const now = new Date();
  els.countDate.value = now.toISOString().split('T')[0];
  els.startTime.value = now.toTimeString().slice(0,5);
  renderSessions();
  wireEvents();
  createBlankSession();
}

function wireEvents() {
  els.newSessionBtn.addEventListener('click', () => {
    if (confirm('Start a new session? Unsaved changes in the current session should be saved first.')) {
      createBlankSession();
    }
  });

  els.saveSessionBtn.addEventListener('click', saveCurrentSession);
  els.addRowBtn.addEventListener('click', () => addItemRow());
  els.csvFile.addEventListener('change', handleCsvImport);
  els.sessionSearch.addEventListener('input', renderSessions);
  els.quickFilter.addEventListener('input', applyQuickFilter);
  els.exportSessionBtn.addEventListener('click', exportCurrentSessionCsv);
  els.exportAllBtn.addEventListener('click', exportAllDataJson);
  els.clearAllBtn.addEventListener('click', clearAllData);
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { sessions: [] };
  } catch {
    return { sessions: [] };
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function createBlankSession() {
  currentSessionId = crypto.randomUUID();
  els.counterName.value = '';
  els.stockCountId.value = '';
  els.siteId.value = '';
  els.status.value = 'Started';
  const now = new Date();
  els.countDate.value = now.toISOString().split('T')[0];
  els.startTime.value = now.toTimeString().slice(0,5);
  els.itemsTableBody.innerHTML = '';
  addItemRow();
  updateWorksheetMeta();
}

function getSessionFromForm() {
  const items = [...els.itemsTableBody.querySelectorAll('tr')].map(tr => {
    const row = {};
    tr.querySelectorAll('[data-field]').forEach(el => {
      const key = el.dataset.field;
      row[key] = el.type === 'checkbox' ? el.checked : el.value;
    });
    row.on_hand_qty = parseFloat(row.on_hand_qty || 0) || 0;
    row.counted_qty = parseFloat(row.counted_qty || 0) || 0;
    row.variance = row.counted_qty - row.on_hand_qty;
    return row;
  });

  return {
    id: currentSessionId,
    counter_name: els.counterName.value.trim(),
    stock_count_id: els.stockCountId.value.trim(),
    site_id: els.siteId.value.trim(),
    status: els.status.value,
    count_date: els.countDate.value,
    start_time: els.startTime.value,
    updated_at: new Date().toISOString(),
    items
  };
}

function saveCurrentSession() {
  const session = getSessionFromForm();
  const idx = appState.sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) appState.sessions[idx] = session;
  else appState.sessions.unshift(session);
  persistState();
  renderSessions();
  updateWorksheetMeta();
  alert('Session saved.');
}

function loadSession(id) {
  const session = appState.sessions.find(s => s.id === id);
  if (!session) return;
  currentSessionId = session.id;
  els.counterName.value = session.counter_name || '';
  els.stockCountId.value = session.stock_count_id || '';
  els.siteId.value = session.site_id || '';
  els.status.value = session.status || 'Started';
  els.countDate.value = session.count_date || '';
  els.startTime.value = session.start_time || '';
  els.itemsTableBody.innerHTML = '';
  (session.items || []).forEach(item => addItemRow(item));
  if (!session.items || !session.items.length) addItemRow();
  updateWorksheetMeta();
}

function duplicateSession(id) {
  const session = structuredClone(appState.sessions.find(s => s.id === id));
  if (!session) return;
  session.id = crypto.randomUUID();
  session.status = 'Started';
  session.updated_at = new Date().toISOString();
  session.count_date = new Date().toISOString().split('T')[0];
  appState.sessions.unshift(session);
  persistState();
  renderSessions();
}

function deleteSession(id) {
  if (!confirm('Delete this saved session?')) return;
  appState.sessions = appState.sessions.filter(s => s.id !== id);
  persistState();
  renderSessions();
  if (currentSessionId === id) createBlankSession();
}

function renderSessions() {
  const q = els.sessionSearch.value.trim().toLowerCase();
  const sessions = appState.sessions.filter(s => {
    const blob = `${s.stock_count_id} ${s.counter_name} ${s.site_id} ${s.count_date}`.toLowerCase();
    return blob.includes(q);
  });

  els.sessionsList.innerHTML = '';
  if (!sessions.length) {
    els.sessionsList.innerHTML = '<div class="session-card"><div class="session-meta">No saved sessions yet.</div></div>';
    return;
  }

  sessions.forEach(session => {
    const card = document.createElement('div');
    card.className = 'session-card';
    card.innerHTML = `
      <strong>${escapeHtml(session.stock_count_id || 'Untitled Session')}</strong>
      <div class="session-meta">
        ${escapeHtml(session.counter_name || 'No counter')} • ${escapeHtml(session.count_date || 'No date')} • ${escapeHtml(session.status || 'Started')}<br>
        Site: ${escapeHtml(session.site_id || '-')} • Rows: ${(session.items || []).length}
      </div>
      <div class="session-actions">
        <button data-action="load">Load</button>
        <button class="secondary" data-action="duplicate">Duplicate</button>
        <button class="danger" data-action="delete">Delete</button>
      </div>
    `;
    card.querySelector('[data-action="load"]').onclick = () => loadSession(session.id);
    card.querySelector('[data-action="duplicate"]').onclick = () => duplicateSession(session.id);
    card.querySelector('[data-action="delete"]').onclick = () => deleteSession(session.id);
    els.sessionsList.appendChild(card);
  });
}

function addItemRow(data = {}) {
  const clone = els.rowTemplate.content.cloneNode(true);
  const tr = clone.querySelector('tr');
  tr.querySelectorAll('[data-field]').forEach(input => {
    const key = input.dataset.field;
    if (input.type === 'checkbox') input.checked = !!data[key];
    else input.value = data[key] ?? '';
    input.addEventListener('input', () => {
      updateVariance(tr);
      updateWorksheetMeta();
    });
    input.addEventListener('change', () => {
      updateVariance(tr);
      updateWorksheetMeta();
    });
  });

  tr.querySelector('.delete-row').addEventListener('click', () => {
    tr.remove();
    updateWorksheetMeta();
  });

  els.itemsTableBody.appendChild(tr);
  updateVariance(tr);
  applyQuickFilter();
}

function updateVariance(tr) {
  const onHand = parseFloat(tr.querySelector('[data-field="on_hand_qty"]').value || 0) || 0;
  const counted = parseFloat(tr.querySelector('[data-field="counted_qty"]').value || 0) || 0;
  const variance = counted - onHand;
  const cell = tr.querySelector('[data-field="variance"]');
  cell.textContent = variance;
  cell.className = 'variance-cell';
  if (variance === 0) cell.classList.add('variance-zero');
  else if (variance > 0) cell.classList.add('variance-good');
  else cell.classList.add('variance-bad');
}

function updateWorksheetMeta() {
  const rowCount = els.itemsTableBody.querySelectorAll('tr').length;
  const doneCount = [...els.itemsTableBody.querySelectorAll('[data-field="done"]')].filter(x => x.checked).length;
  const countId = els.stockCountId.value || 'No count ID';
  const counter = els.counterName.value || 'No counter';
  const date = els.countDate.value || 'No date';
  els.worksheetMeta.textContent = `${countId} • ${counter} • ${date} • ${doneCount}/${rowCount} rows marked done`;
}

function handleCsvImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    const rows = parseCsv(text);
    if (!rows.length) {
      alert('No rows found in CSV.');
      return;
    }
    els.itemsTableBody.innerHTML = '';
    rows.forEach(row => addItemRow(row));
    updateWorksheetMeta();
    alert(`Imported ${rows.length} rows.`);
  };
  reader.readAsText(file);
  event.target.value = '';
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(h => normalizeHeader(h));
  return lines.slice(1).filter(Boolean).map(line => {
    const values = splitCsvLine(line);
    const obj = {};
    headers.forEach((header, i) => obj[header] = values[i] ?? '');
    return {
      site_id: obj.site_id || obj.site || '',
      bin: obj.bin || '',
      item_number: obj.item_number || obj.item || '',
      description: obj.description || '',
      uom: obj.uom || '',
      on_hand_qty: obj.on_hand_qty || obj.on_hand || 0,
      counted_qty: obj.counted_qty || 0,
      lot_serial: obj.lot_serial || obj.lot || '',
      note: obj.note || '',
      done: false
    };
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeHeader(h) {
  return h.toLowerCase().trim().replace(/\s+/g, '_');
}

function applyQuickFilter() {
  const q = els.quickFilter.value.trim().toLowerCase();
  [...els.itemsTableBody.querySelectorAll('tr')].forEach(tr => {
    const txt = tr.innerText.toLowerCase();
    tr.style.display = txt.includes(q) ? '' : 'none';
  });
}

function exportCurrentSessionCsv() {
  const session = getSessionFromForm();
  const headers = ['site_id','bin','item_number','description','uom','on_hand_qty','counted_qty','variance','lot_serial','note','done'];
  const lines = [headers.join(',')];
  session.items.forEach(item => {
    lines.push(headers.map(h => csvEscape(item[h] ?? '')).join(','));
  });
  downloadFile(`${(session.stock_count_id || 'stock-count').replace(/[^a-z0-9-_]+/gi, '_')}.csv`, lines.join('\n'), 'text/csv');
}

function exportAllDataJson() {
  downloadFile('stock-count-data.json', JSON.stringify(appState, null, 2), 'application/json');
}

function clearAllData() {
  if (!confirm('This will remove all saved sessions from this browser. Continue?')) return;
  localStorage.removeItem(STORAGE_KEY);
  appState = { sessions: [] };
  renderSessions();
  createBlankSession();
}

function csvEscape(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
