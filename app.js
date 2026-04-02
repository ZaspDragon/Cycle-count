const STORAGE_KEY = "cycleCountPro_simple_v2";
const DOWNTIME_LIMIT_MINUTES = 25;

const defaultState = {
  currentSessionId: null,
  sessions: {}
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
  totalRows: document.getElementById("totalRows"),
  doneRows: document.getElementById("doneRows"),
  varianceRows: document.getElementById("varianceRows"),
  activityEvents: document.getElementById("activityEvents"),
  downtimeEvents: document.getElementById("downtimeEvents")
};

init();

function init() {
  setDefaults();
  bindEvents();
  renderAll();
}

function bindEvents() {
  const startSessionBtn = document.getElementById("startSessionBtn");
  const saveSessionBtn = document.getElementById("saveSessionBtn");
  const addRowBtn = document.getElementById("addRowBtn");
  const exportSessionCsvBtn = document.getElementById("exportSessionCsvBtn");
  const exportAllJsonBtn = document.getElementById("exportAllJsonBtn");
  const clearSavedBtn = document.getElementById("clearSavedBtn");

  if (startSessionBtn) startSessionBtn.addEventListener("click", startSession);
  if (saveSessionBtn) saveSessionBtn.addEventListener("click", saveCurrentSession);
  if (addRowBtn) addRowBtn.addEventListener("click", onAddRow);
  if (exportSessionCsvBtn) exportSessionCsvBtn.addEventListener("click", exportCurrentSessionCsv);
  if (exportAllJsonBtn) exportAllJsonBtn.addEventListener("click", exportAllJson);
  if (clearSavedBtn) clearSavedBtn.addEventListener("click", clearSavedData);

  if (els.worksheetBody) {
    els.worksheetBody.addEventListener("input", handleRowInput);
    els.worksheetBody.addEventListener("change", handleRowInput);
    els.worksheetBody.addEventListener("click", handleRowClick);
  }
}

function onAddRow() {
  ensureSession();
  addRow();
  saveState();
  renderWorksheet();
  renderStats();
  renderSavedSessions();
}

function generateId() {
  return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return deepClone(defaultState);

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return deepClone(defaultState);
    }

    if (!parsed.sessions || typeof parsed.sessions !== "object") {
      parsed.sessions = {};
    }

    if (!("currentSessionId" in parsed)) {
      parsed.currentSessionId = null;
    }

    return parsed;
  } catch (e) {
    console.error("Load state failed:", e);
    return deepClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function setDefaults() {
  const now = new Date();

  if (els.countDate && !els.countDate.value) {
    els.countDate.value = now.toISOString().slice(0, 10);
  }

  if (els.startTime && !els.startTime.value) {
    els.startTime.value = now.toTimeString().slice(0, 5);
  }
}

function startSession() {
  const id = generateId();

  const session = {
    id: id,
    counterName: (els.counterName.value || "").trim() || "Unknown Counter",
    stockCountId: (els.stockCountId.value || "").trim() || ("CC-" + new Date().toISOString().slice(0, 10)),
    siteId: (els.siteId.value || "").trim() || "OHC",
    status: els.status.value || "In Progress",
    countDate: els.countDate.value || new Date().toISOString().slice(0, 10),
    startTime: els.startTime.value || new Date().toTimeString().slice(0, 5),
    rows: [],
    activityLog: [],
    downtimeLog: [],
    lastCountTime: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.sessions[id] = session;
  state.currentSessionId = id;
  saveState();
  renderAll();
  alert("New session started.");
}

function ensureSession() {
  if (!state.currentSessionId || !state.sessions[state.currentSessionId]) {
    startSession();
  }
}

function getCurrentSession() {
  if (!state.currentSessionId) return null;
  return state.sessions[state.currentSessionId] || null;
}

function saveCurrentSession() {
  const session = getCurrentSession();

  if (!session) {
    alert("Start a session first.");
    return;
  }

  session.counterName = (els.counterName.value || "").trim() || session.counterName;
  session.stockCountId = (els.stockCountId.value || "").trim() || session.stockCountId;
  session.siteId = (els.siteId.value || "").trim() || session.siteId;
  session.status = els.status.value || session.status;
  session.countDate = els.countDate.value || session.countDate;
  session.startTime = els.startTime.value || session.startTime;
  session.updatedAt = new Date().toISOString();

  saveState();
  renderSessionInfo();
  renderSavedSessions();
  alert("Session saved.");
}

function addRow(prefill = {}) {
  const session = getCurrentSession();
  if (!session) return;

  session.rows.push({
    id: generateId(),
    site_id: prefill.site_id || session.siteId || "",
    bin: prefill.bin || "",
    item_number: prefill.item_number || "",
    description: prefill.description || "",
    uom: prefill.uom || "",
    on_hand_qty: prefill.on_hand_qty != null ? prefill.on_hand_qty : "",
    counted_qty: prefill.counted_qty != null ? prefill.counted_qty : "",
    variance: "",
    reason_code: prefill.reason_code || "",
    done: false,
    count_time: "",
    last_logged_count_time: null,
    last_logged_count_value: null
  });

  session.updatedAt = new Date().toISOString();
}

function handleRowInput(event) {
  const field = event.target.dataset.field;
  if (!field) return;

  const rowEl = event.target.closest("tr");
  if (!rowEl) return;

  const rowId = rowEl.dataset.rowId;
  const session = getCurrentSession();
  if (!session) return;

  const row = session.rows.find(r => r.id === rowId);
  if (!row) return;

  if (event.target.type === "checkbox") {
    row[field] = event.target.checked;
  } else {
    row[field] = event.target.value;
  }

  const onHand = parseNullableNumber(row.on_hand_qty);
  const counted = parseNullableNumber(row.counted_qty);

  if (onHand !== null && counted !== null) {
    row.variance = String(counted - onHand);
  } else {
    row.variance = "";
  }

  const varianceInput = rowEl.querySelector('[data-field="variance"]');
  if (varianceInput) {
    varianceInput.value = row.variance;
  }

  const isCountEvent =
    field === "counted_qty" &&
    row.counted_qty !== "" &&
    row.counted_qty !== null &&
    row.counted_qty !== undefined;

  if (isCountEvent) {
    const didLog = recordCountEvent(row);

    if (didLog) {
      const countTimeSpan = rowEl.querySelector('[data-field="count_time"]');
      if (countTimeSpan) {
        countTimeSpan.textContent = row.count_time || "—";
      }
    }
  }

  session.updatedAt = new Date().toISOString();
  saveState();

  renderStats();
  renderDowntime();
  renderSavedSessions();
}

function recordCountEvent(row) {
  const session = getCurrentSession();
  if (!session) return false;

  const nowIso = new Date().toISOString();
  const currentCountValue = String(row.counted_qty);

  if (row.last_logged_count_value === currentCountValue) {
    return false;
  }

  if (row.last_logged_count_time) {
    const secondsSinceLastLog = (new Date(nowIso) - new Date(row.last_logged_count_time)) / 1000;
    if (secondsSinceLastLog < 1) {
      return false;
    }
  }

  if (session.lastCountTime) {
    const gapMin = minutesBetween(session.lastCountTime, nowIso);

    if (gapMin > DOWNTIME_LIMIT_MINUTES) {
      session.downtimeLog.unshift({
        id: generateId(),
        previousCountTime: session.lastCountTime,
        currentCountTime: nowIso,
        gapMin: round2(gapMin),
        bin: row.bin || "",
        item_number: row.item_number || ""
      });
    }
  }

  row.count_time = formatDateTime(nowIso);
  row.last_logged_count_time = nowIso;
  row.last_logged_count_value = currentCountValue;

  session.activityLog.unshift({
    id: generateId(),
    time: nowIso,
    bin: row.bin || "",
    item_number: row.item_number || "",
    counted_qty: row.counted_qty || ""
  });

  session.lastCountTime = nowIso;
  return true;
}

function handleRowClick(event) {
  const action = event.target.dataset.action;
  if (action !== "delete") return;

  const rowEl = event.target.closest("tr");
  if (!rowEl) return;

  const rowId = rowEl.dataset.rowId;
  const session = getCurrentSession();
  if (!session) return;

  session.rows = session.rows.filter(r => r.id !== rowId);
  session.updatedAt = new Date().toISOString();

  saveState();
  renderAll();
}

function renderAll() {
  renderSessionInfo();
  renderWorksheet();
  renderStats();
  renderDowntime();
  renderSavedSessions();
}

function renderSessionInfo() {
  const session = getCurrentSession();

  if (!session) {
    els.sessionBadge.textContent = "No active session";
    els.sessionBadge.className = "badge muted";
    return;
  }

  els.counterName.value = session.counterName || "";
  els.stockCountId.value = session.stockCountId || "";
  els.siteId.value = session.siteId || "";
  els.status.value = session.status || "In Progress";
  els.countDate.value = session.countDate || "";
  els.startTime.value = session.startTime || "";

  els.sessionBadge.textContent = session.counterName + " • " + session.stockCountId;
  els.sessionBadge.className = "badge";
}

function renderWorksheet() {
  const session = getCurrentSession();
  els.worksheetBody.innerHTML = "";

  if (!session) return;

  const tmpl = document.getElementById("rowTemplate");
  if (!tmpl) return;

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
        el.value = row[field] != null ? row[field] : "";
      }
    });

    els.worksheetBody.appendChild(clone);
  });
}

function renderStats() {
  const session = getCurrentSession();
  const rows = session ? session.rows : [];

  els.totalRows.textContent = rows.length;
  els.doneRows.textContent = rows.filter(r => r.done).length;
  els.varianceRows.textContent = rows.filter(r => String(r.variance) !== "" && Number(r.variance) !== 0).length;
  els.activityEvents.textContent = session ? session.activityLog.length : 0;
  els.downtimeEvents.textContent = session ? session.downtimeLog.length : 0;
}

function renderDowntime() {
  const session = getCurrentSession();

  if (!session || !session.downtimeLog.length) {
    els.downtimeLog.className = "empty-state";
    els.downtimeLog.textContent = "No downtime events yet.";
    return;
  }

  els.downtimeLog.className = "log-list";
  els.downtimeLog.innerHTML = session.downtimeLog.map(item => `
    <div class="log-item">
      <strong>${item.gapMin} minute gap</strong>
      <div>Previous count: ${formatDateTime(item.previousCountTime)}</div>
      <div>Next count: ${formatDateTime(item.currentCountTime)}</div>
      <div>Triggered by: Bin ${escapeHtml(item.bin || "—")} | Item ${escapeHtml(item.item_number || "—")}</div>
    </div>
  `).join("");
}

function renderSavedSessions() {
  const sessions = Object.values(state.sessions).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  if (!sessions.length) {
    els.savedSessions.className = "empty-state";
    els.savedSessions.textContent = "No saved sessions yet.";
    return;
  }

  els.savedSessions.className = "saved-session-list";
  els.savedSessions.innerHTML = sessions.map(session => `
    <div class="session-item">
      <strong>${escapeHtml(session.counterName)} • ${escapeHtml(session.stockCountId)}</strong>
      <div>${escapeHtml(session.siteId)} • ${escapeHtml(session.countDate)} • ${escapeHtml(session.status)}</div>
      <div>${session.rows.length} rows • ${session.activityLog.length} counts • ${session.downtimeLog.length} downtime events</div>
      <div class="actions">
        <button class="btn secondary" data-session-action="load" data-session-id="${session.id}">Load</button>
        <button class="btn danger" data-session-action="delete" data-session-id="${session.id}">Delete</button>
      </div>
    </div>
  `).join("");

  els.savedSessions.querySelectorAll("[data-session-action]").forEach(btn => {
    btn.addEventListener("click", function () {
      const id = btn.dataset.sessionId;
      const action = btn.dataset.sessionAction;

      if (action === "load") {
        state.currentSessionId = id;
      } else if (action === "delete") {
        if (state.currentSessionId === id) {
          state.currentSessionId = null;
        }
        delete state.sessions[id];
      }

      saveState();
      renderAll();
    });
  });
}

function exportCurrentSessionCsv() {
  const session = getCurrentSession();

  if (!session) {
    alert("No active session to export.");
    return;
  }

  const headers = [
    "site_id",
    "bin",
    "item_number",
    "description",
    "uom",
    "on_hand_qty",
    "counted_qty",
    "variance",
    "reason_code",
    "done",
    "count_time"
  ];

  const csv = [headers.join(",")]
    .concat(
      session.rows.map(row =>
        headers.map(h => csvSafe(row[h])).join(",")
      )
    )
    .join("\n");

  downloadFile(csv, (session.stockCountId || "cycle-count") + "-session.csv", "text/csv;charset=utf-8;");
}

function exportAllJson() {
  downloadFile(JSON.stringify(state, null, 2), "cycle-count-pro-data.json", "application/json;charset=utf-8;");
}

function clearSavedData() {
  if (!confirm("Clear all saved data from this browser?")) return;

  state = deepClone(defaultState);
  saveState();
  renderAll();
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

function minutesBetween(startIso, endIso) {
  return (new Date(endIso) - new Date(startIso)) / 60000;
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function parseNullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function round2(num) {
  return Math.round(num * 100) / 100;
}

function csvSafe(value) {
  const text = String(value == null ? "" : value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
