const STORAGE_KEY = "cycleCountPro_v1";

const defaultState = {
  settings: {
    downtimeThreshold: 25,
    breakOne: 15,
    breakTwo: 15,
    lunchBreak: 30,
  },
  currentSessionId: null,
  sessions: {},
};

let state = loadState();

const els = {
  counterName: document.getElementById("counterName"),
  stockCountId: document.getElementById("stockCountId"),
  siteId: document.getElementById("siteId"),
  status: document.getElementById("status"),
  countDate: document.getElementById("countDate"),
  startTime: document.getElementById("startTime"),
  sessionBadge: document.getElementById("sessionBadge"),
  worksheetBody: document.getElementById("worksheetBody"),
  downtimeLog: document.getElementById("downtimeLog"),
  savedSessions: document.getElementById("savedSessions"),
  downtimeThreshold: document.getElementById("downtimeThreshold"),
  breakOne: document.getElementById("breakOne"),
  breakTwo: document.getElementById("breakTwo"),
  lunchBreak: document.getElementById("lunchBreak"),
  totalRows: document.getElementById("totalRows"),
  doneRows: document.getElementById("doneRows"),
  varianceRows: document.getElementById("varianceRows"),
  recountRows: document.getElementById("recountRows"),
  downtimeEvents: document.getElementById("downtimeEvents"),
  activityEvents: document.getElementById("activityEvents"),
  lastCountDisplay: document.getElementById("lastCountDisplay"),
  idleGapDisplay: document.getElementById("idleGapDisplay"),
  netDowntimeDisplay: document.getElementById("netDowntimeDisplay"),
  csvInput: document.getElementById("csvInput"),
};

bindEvents();
applySettingsToInputs();
setDefaults();
renderAll();
setInterval(updateLiveGap, 15000);

function bindEvents() {
  document.getElementById("startSessionBtn").addEventListener("click", startSession);
  document.getElementById("saveSessionBtn").addEventListener("click", saveCurrentSession);
  document.getElementById("addRowBtn").addEventListener("click", () => {
    ensureSession();
    addRow();
    saveState();
    renderAll();
  });
  document.getElementById("saveRulesBtn").addEventListener("click", saveRules);
  document.getElementById("simulateGapBtn").addEventListener("click", checkCurrentGap);
  document.getElementById("exportSessionCsvBtn").addEventListener("click", exportCurrentSessionCsv);
  document.getElementById("exportAllJsonBtn").addEventListener("click", exportAllJson);
  document.getElementById("clearSavedBtn").addEventListener("click", clearSavedData);
  els.csvInput.addEventListener("change", importCsv);
  els.worksheetBody.addEventListener("input", handleRowInput);
  els.worksheetBody.addEventListener("change", handleRowInput);
  els.worksheetBody.addEventListener("click", handleRowClick);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    return deepMerge(structuredClone(defaultState), JSON.parse(raw));
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setDefaults() {
  const now = new Date();
  els.countDate.value = now.toISOString().slice(0, 10);
  els.startTime.value = now.toTimeString().slice(0, 5);
}

function applySettingsToInputs() {
  els.downtimeThreshold.value = state.settings.downtimeThreshold;
  els.breakOne.value = state.settings.breakOne;
  els.breakTwo.value = state.settings.breakTwo;
  els.lunchBreak.value = state.settings.lunchBreak;
}

function saveRules() {
  state.settings = {
    downtimeThreshold: asNumber(els.downtimeThreshold.value, 25),
    breakOne: asNumber(els.breakOne.value, 15),
    breakTwo: asNumber(els.breakTwo.value, 15),
    lunchBreak: asNumber(els.lunchBreak.value, 30),
  };
  saveState();
  renderAll();
}

function startSession() {
  const id = crypto.randomUUID();
  const session = {
    id,
    counterName: els.counterName.value.trim() || "Unknown Counter",
    stockCountId: els.stockCountId.value.trim() || `CC-${new Date().toISOString().slice(5, 10).replace('-', '')}`,
    siteId: els.siteId.value.trim() || "OHC",
    status: els.status.value,
    countDate: els.countDate.value || new Date().toISOString().slice(0, 10),
    startTime: els.startTime.value || new Date().toTimeString().slice(0, 5),
    rows: [],
    activityLog: [],
    downtimeLog: [],
    lastActivityAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.sessions[id] = session;
  state.currentSessionId = id;
  saveState();
  renderAll();
}

function ensureSession() {
  if (!state.currentSessionId || !state.sessions[state.currentSessionId]) {
    startSession();
  }
}

function getCurrentSession() {
  return state.sessions[state.currentSessionId] || null;
}

function saveCurrentSession() {
  const session = getCurrentSession();
  if (!session) {
    alert("Start a session first.");
    return;
  }
  session.counterName = els.counterName.value.trim() || session.counterName;
  session.stockCountId = els.stockCountId.value.trim() || session.stockCountId;
  session.siteId = els.siteId.value.trim() || session.siteId;
  session.status = els.status.value;
  session.countDate = els.countDate.value || session.countDate;
  session.startTime = els.startTime.value || session.startTime;
  session.updatedAt = new Date().toISOString();
  saveState();
  renderAll();
}

function addRow(prefill = {}) {
  const session = getCurrentSession();
  if (!session) return;
  session.rows.push({
    id: crypto.randomUUID(),
    site_id: prefill.site_id || session.siteId || "",
    bin: prefill.bin || "",
    item_number: prefill.item_number || "",
    description: prefill.description || "",
    uom: prefill.uom || "",
    on_hand_qty: valueOrBlank(prefill.on_hand_qty),
    counted_qty: valueOrBlank(prefill.counted_qty),
    variance: "",
    lot_serial: prefill.lot_serial || "",
    reason_code: prefill.reason_code || "",
    done: false,
    activity_time: "",
  });
}

function handleRowInput(event) {
  const field = event.target.dataset.field;
  if (!field) return;
  const rowEl = event.target.closest("tr");
  const rowId = rowEl?.dataset.rowId;
  const session = getCurrentSession();
  if (!session || !rowId) return;
  const row = session.rows.find(r => r.id === rowId);
  if (!row) return;

  if (event.target.type === "checkbox") {
    row[field] = event.target.checked;
  } else {
    row[field] = event.target.value;
  }

  const onHand = asNumber(row.on_hand_qty, null);
  const counted = asNumber(row.counted_qty, null);
  row.variance = (onHand !== null && counted !== null) ? String(counted - onHand) : "";

  const significantFields = ["bin", "item_number", "counted_qty", "done", "reason_code"];
  if (significantFields.includes(field)) {
    row.activity_time = formatDateTime(new Date().toISOString());
    registerActivity(`${row.bin || 'No Bin'} • ${row.item_number || 'No Item'}`);
  }

  session.updatedAt = new Date().toISOString();
  saveState();
  renderWorksheet();
  renderStats();
  renderDowntime();
  updateLiveGap();
}

function handleRowClick(event) {
  const action = event.target.dataset.action;
  if (action !== "delete") return;
  const rowEl = event.target.closest("tr");
  const rowId = rowEl?.dataset.rowId;
  const session = getCurrentSession();
  if (!session || !rowId) return;
  session.rows = session.rows.filter(r => r.id !== rowId);
  session.updatedAt = new Date().toISOString();
  saveState();
  renderAll();
}

function registerActivity(detail) {
  const session = getCurrentSession();
  if (!session) return;
  const nowIso = new Date().toISOString();
  if (session.lastActivityAt) {
    const gapMin = minutesBetween(session.lastActivityAt, nowIso);
    if (gapMin >= state.settings.downtimeThreshold) {
      const excluded = state.settings.breakOne + state.settings.breakTwo + state.settings.lunchBreak;
      const net = Math.max(0, gapMin - excluded);
      session.downtimeLog.unshift({
        id: crypto.randomUUID(),
        start: session.lastActivityAt,
        end: nowIso,
        gapMin: round2(gapMin),
        excludedMin: excluded,
        netMin: round2(net),
        detail,
      });
    }
  }
  session.activityLog.unshift({
    id: crypto.randomUUID(),
    time: nowIso,
    detail,
  });
  session.lastActivityAt = nowIso;
}

function checkCurrentGap() {
  const session = getCurrentSession();
  if (!session?.lastActivityAt) {
    alert("No activity recorded yet. Save or update a row first.");
    return;
  }
  const nowIso = new Date().toISOString();
  const gapMin = minutesBetween(session.lastActivityAt, nowIso);
  if (gapMin >= state.settings.downtimeThreshold) {
    const excluded = state.settings.breakOne + state.settings.breakTwo + state.settings.lunchBreak;
    const net = Math.max(0, gapMin - excluded);
    session.downtimeLog.unshift({
      id: crypto.randomUUID(),
      start: session.lastActivityAt,
      end: nowIso,
      gapMin: round2(gapMin),
      excludedMin: excluded,
      netMin: round2(net),
      detail: "Manual gap check",
    });
    saveState();
    renderDowntime();
    renderStats();
  } else {
    alert(`Current gap is ${round2(gapMin)} minutes. That is below your ${state.settings.downtimeThreshold}-minute rule.`);
  }
  updateLiveGap();
}

function renderAll() {
  renderSessionInfo();
  renderWorksheet();
  renderStats();
  renderDowntime();
  renderSavedSessions();
  updateLiveGap();
}

function renderSessionInfo() {
  const session = getCurrentSession();
  if (!session) {
    els.sessionBadge.textContent = "No active session";
    els.sessionBadge.className = "badge muted";
    return;
  }
  els.counterName.value = session.counterName;
  els.stockCountId.value = session.stockCountId;
  els.siteId.value = session.siteId;
  els.status.value = session.status;
  els.countDate.value = session.countDate;
  els.startTime.value = session.startTime;
  els.sessionBadge.textContent = `${session.counterName} • ${session.stockCountId}`;
  els.sessionBadge.className = "badge";
}

function renderWorksheet() {
  const session = getCurrentSession();
  els.worksheetBody.innerHTML = "";
  if (!session) return;

  const tmpl = document.getElementById("rowTemplate");
  session.rows.forEach(row => {
    const clone = tmpl.content.firstElementChild.cloneNode(true);
    clone.dataset.rowId = row.id;
    clone.querySelectorAll("[data-field]").forEach(el => {
      const field = el.dataset.field;
      if (el.tagName === "SPAN") {
        el.textContent = row[field] || "—";
      } else if (el.type === "checkbox") {
        el.checked = !!row[field];
      } else {
        el.value = row[field] ?? "";
      }
    });
    els.worksheetBody.appendChild(clone);
  });
}

function renderStats() {
  const session = getCurrentSession();
  const rows = session?.rows || [];
  els.totalRows.textContent = rows.length;
  els.doneRows.textContent = rows.filter(r => r.done).length;
  els.varianceRows.textContent = rows.filter(r => String(r.variance) !== "" && Number(r.variance) !== 0).length;
  els.recountRows.textContent = rows.filter(r => r.reason_code === "Recount Required").length;
  els.downtimeEvents.textContent = session?.downtimeLog.length || 0;
  els.activityEvents.textContent = session?.activityLog.length || 0;
}

function renderDowntime() {
  const session = getCurrentSession();
  if (!session || !session.downtimeLog.length) {
    els.downtimeLog.className = "log-list empty-state";
    els.downtimeLog.textContent = "No downtime events yet.";
    return;
  }
  els.downtimeLog.className = "log-list";
  els.downtimeLog.innerHTML = session.downtimeLog.map(item => `
    <div class="log-item alert">
      <strong>${item.gapMin} min gap</strong>
      <div><span class="warn">Net downtime after breaks:</span> ${item.netMin} min</div>
      <div>From ${formatDateTime(item.start)} to ${formatDateTime(item.end)}</div>
      <div>Trigger: ${escapeHtml(item.detail)}</div>
    </div>
  `).join("");
}

function renderSavedSessions() {
  const sessions = Object.values(state.sessions).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if (!sessions.length) {
    els.savedSessions.className = "saved-session-list empty-state";
    els.savedSessions.textContent = "No saved sessions yet.";
    return;
  }
  els.savedSessions.className = "saved-session-list";
  els.savedSessions.innerHTML = sessions.map(session => `
    <div class="session-item">
      <strong>${escapeHtml(session.counterName)} • ${escapeHtml(session.stockCountId)}</strong>
      <div>${escapeHtml(session.siteId)} • ${escapeHtml(session.countDate)} • ${escapeHtml(session.status)}</div>
      <div>${session.rows.length} rows • ${session.downtimeLog.length} downtime events</div>
      <div class="actions">
        <button class="btn secondary" data-session-action="load" data-session-id="${session.id}">Load</button>
        <button class="btn danger" data-session-action="delete" data-session-id="${session.id}">Delete</button>
      </div>
    </div>
  `).join("");

  els.savedSessions.querySelectorAll("[data-session-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.sessionId;
      const action = btn.dataset.sessionAction;
      if (action === "load") {
        state.currentSessionId = id;
      } else if (action === "delete") {
        if (state.currentSessionId === id) state.currentSessionId = null;
        delete state.sessions[id];
      }
      saveState();
      renderAll();
    });
  });
}

function updateLiveGap() {
  const session = getCurrentSession();
  if (!session?.lastActivityAt) {
    els.lastCountDisplay.textContent = "—";
    els.idleGapDisplay.textContent = "0 min";
    els.netDowntimeDisplay.textContent = "0 min";
    return;
  }
  const gap = minutesBetween(session.lastActivityAt, new Date().toISOString());
  const excluded = state.settings.breakOne + state.settings.breakTwo + state.settings.lunchBreak;
  const net = Math.max(0, gap - excluded);
  els.lastCountDisplay.textContent = formatDateTime(session.lastActivityAt);
  els.idleGapDisplay.textContent = `${round2(gap)} min`;
  els.netDowntimeDisplay.textContent = `${round2(net)} min`;
}

function importCsv(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  ensureSession();
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || "");
    const rows = parseCsv(text);
    rows.forEach(row => addRow(row));
    saveState();
    renderAll();
    els.csvInput.value = "";
  };
  reader.readAsText(file);
}

function exportCurrentSessionCsv() {
  const session = getCurrentSession();
  if (!session) {
    alert("No active session to export.");
    return;
  }
  const headers = ["site_id", "bin", "item_number", "description", "uom", "on_hand_qty", "counted_qty", "variance", "lot_serial", "reason_code", "done", "activity_time"];
  const csv = [headers.join(",")]
    .concat(session.rows.map(row => headers.map(h => csvSafe(row[h])).join(",")))
    .join("\n");
  downloadFile(csv, `${session.stockCountId || 'cycle-count'}-session.csv`, "text/csv;charset=utf-8;");
}

function exportAllJson() {
  downloadFile(JSON.stringify(state, null, 2), "cycle-count-pro-data.json", "application/json;charset=utf-8;");
}

function clearSavedData() {
  if (!confirm("Clear all saved sessions and settings from this browser?")) return;
  state = structuredClone(defaultState);
  saveState();
  applySettingsToInputs();
  setDefaults();
  renderAll();
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    const obj = {};
    headers.forEach((header, i) => obj[header] = values[i] || "");
    return obj;
  });
}

function splitCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      out.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current.trim());
  return out.map(value => value.replace(/^"|"$/g, ""));
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      target[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function minutesBetween(startIso, endIso) {
  return (new Date(endIso) - new Date(startIso)) / 60000;
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function asNumber(value, fallback) {
  if (value === "" || value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function csvSafe(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function round2(num) {
  return Math.round(num * 100) / 100;
}

function valueOrBlank(value) {
  return value === undefined || value === null ? "" : value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
