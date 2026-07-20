// Student Dashboard JS
let allAssignments = [], currentUser = null;
let submitAssignmentId = null;
let selectedSubmitFile = null;

window.addEventListener("DOMContentLoaded", async () => {
  loadTheme();
  await checkAuth();
  fetchAssignments();
  fetchStats();
  loadStudentProfile();
  setupGlobalClickDelegation();

  document.getElementById("search").addEventListener("input", renderAssignments);
  document.getElementById("filter").addEventListener("change", renderAssignments);
  document.getElementById("priorityFilter").addEventListener("change", renderAssignments);
});

async function checkAuth() {
  const res = await fetch("/auth/me");
  if (!res.ok) { window.location.href = "/login.html"; return; }
  const user = await res.json();
  if (user.role !== "student") { window.location.href = "/login.html"; return; }
  currentUser = user;
  document.getElementById("welcomeName").textContent = `👋 ${currentUser.name}`;
}

async function logout() { await fetch("/auth/logout", { method: "POST" }); window.location.href = "/login.html"; }

// ─── STATS ──────────────────────────────────
async function fetchStats() {
  try {
    const res = await fetch("/assignments/dashboard/stats");
    const stats = await res.json();
    document.getElementById("stat-total").textContent     = stats.total;
    document.getElementById("stat-completed").textContent = stats.completed;
    document.getElementById("stat-pending").textContent   = stats.pending;
  } catch (e) { console.error("Stats error:", e); }
}

// ─── PROFILE / INFO BAR ─────────────────────
// currentUser (from /auth/me) doesn't carry rollNumber/cpi/year — those
// only live on the full profile, so this is fetched separately.
async function loadStudentProfile() {
  try {
    const res = await fetch("/students/my-profile");
    if (!res.ok) return;
    const s = await res.json();

    document.getElementById("infoSection").textContent = s.section    || "-";
    document.getElementById("infoRoll").textContent    = s.rollNumber || "-";
    document.getElementById("infoCpi").textContent     = s.cpi        || "-";
    document.getElementById("infoYear").textContent    = s.year       || "-";

    const dn = document.getElementById("displayName");
    const hn = document.getElementById("headerName");
    const dc = document.getElementById("displayCollege");
    if (dn) dn.textContent = s.name || "Your Name";
    if (hn) hn.textContent = s.name || "My Profile";
    if (dc) dc.textContent = s.branch ? `${esc(s.branch)} • Section ${esc(s.section || "-")}` : "Student";

    const fields = {
      inputName: s.name, inputEmail: s.email, inputBranch: s.branch,
      inputYear: s.year, inputSection: s.section, inputRoll: s.rollNumber, inputCpi: s.cpi
    };
    Object.entries(fields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null && val !== "") el.value = val;
    });

    renderSubjectBreakdown();
  } catch (e) { console.error("Profile error:", e); }
}

// ─── ASSIGNMENTS ────────────────────────────
async function fetchAssignments() {
  try {
    const res = await fetch("/assignments");
    allAssignments = await res.json();
    renderAssignments();
    renderSubjectBreakdown();
  } catch (e) { console.error("Assignments error:", e); }
}

// Finds this student's own submission inside an assignment's submissions array.
function mySubmission(assignment) {
  if (!currentUser) return null;
  return assignment.submissions?.find(s => s.student === currentUser.id) || null;
}

function renderAssignments() {
  const q = document.getElementById("search").value.toLowerCase();
  const f = document.getElementById("filter").value;      // all | pending | submitted
  const p = document.getElementById("priorityFilter").value;

  let list = allAssignments.filter(a => a.title.toLowerCase().includes(q) || a.subject.toLowerCase().includes(q));
  if (p !== "all") list = list.filter(a => a.priority === p);
  if (f !== "all") {
    list = list.filter(a => {
      const sub = mySubmission(a);
      const status = sub ? sub.status : "pending";
      return f === "submitted" ? (status === "submitted" || status === "late") : status === "pending";
    });
  }

  const container = document.getElementById("assignments-container");
  container.innerHTML = "";
  if (!list.length) { container.innerHTML = `<p class="empty-msg">No assignments found!</p>`; return; }
  list.forEach(a => container.appendChild(createAssignmentCard(a)));
}

function createAssignmentCard(a) {
  const deadline = new Date(a.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const pColors  = { high: "#ff6b6b", medium: "#ffd166", low: "#00e5a0" };
  const sub = mySubmission(a);
  const status = sub ? sub.status : "pending";

  const card = document.createElement("div");
  card.className = "assignment-card";
  card.style.borderLeftColor = pColors[a.priority];

  let statusHtml;
  if (status === "pending") {
    statusHtml = `<button class="btn btn-submit" data-action="open-submit" data-id="${esc(a._id)}" data-title="${esc(a.title)}">📤 Submit</button>`;
  } else {
    const badgeClass = status === "late" ? "late-badge" : "submitted-badge";
    const badgeLabel = status === "late" ? "⚠ Late" : "✓ Submitted";
    statusHtml = `
      <span class="${badgeClass}">${badgeLabel}</span>
      ${sub.fileName ? `<div class="file-name">📎 ${esc(sub.fileName)}</div>` : ""}
      <button class="btn btn-submit" style="margin-top:6px" data-action="open-submit" data-id="${esc(a._id)}" data-title="${esc(a.title)}">🔄 Resubmit</button>
      ${sub.grade ? `
        <div class="grade-section">
          <div class="grade-value">Grade: ${esc(sub.grade)}</div>
          ${sub.remarks ? `<div class="grade-remarks">${esc(sub.remarks)}</div>` : ""}
        </div>` : ""}
    `;
  }

  card.innerHTML = `
    <div class="card-info" style="padding-left:.5rem">
      <div class="card-title">${esc(a.title)}</div>
      <div class="card-meta">
        <span class="subject-badge">${esc(a.subject)}</span>
        <span class="deadline-text">📅 ${deadline}</span>
        <span class="priority-badge pri-${a.priority}">${{ high: "🔴 High", medium: "🟡 Medium", low: "🟢 Low" }[a.priority]}</span>
      </div>
      ${a.notes ? `<div class="card-notes">📝 ${esc(a.notes)}</div>` : ""}
    </div>
    <div class="card-actions">${statusHtml}</div>`;
  return card;
}

// ─── SUBMIT MODAL ───────────────────────────
function openSubmitModal(assignmentId, title) {
  submitAssignmentId = assignmentId;
  selectedSubmitFile = null;
  document.getElementById("submitModalTitle").textContent = `Submit: ${title}`;
  document.getElementById("selectedFile").style.display = "none";
  document.getElementById("selectedFile").textContent = "";
  document.getElementById("fileInput").value = "";
  document.getElementById("submitModal").classList.add("open");
}
function closeSubmitModalDirect() { document.getElementById("submitModal").classList.remove("open"); }
function closeSubmitModal(e) { if (e.target.id === "submitModal") closeSubmitModalDirect(); }

function fileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.type !== "application/pdf") { showToast("⚠️ Only PDF files allowed."); input.value = ""; return; }
  if (file.size > 10 * 1024 * 1024) { showToast("⚠️ File must be under 10MB."); input.value = ""; return; }
  selectedSubmitFile = file;
  const el = document.getElementById("selectedFile");
  el.textContent = `✅ ${file.name}`;
  el.style.display = "block";
}

async function submitAssignment() {
  if (!selectedSubmitFile) { showToast("⚠️ Please select a PDF file."); return; }
  const formData = new FormData();
  formData.append("file", selectedSubmitFile);

  try {
    const res = await fetch(`/assignments/${submitAssignmentId}/submit`, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) { showToast(`❌ ${data.error || "Submission failed."}`); return; }
    closeSubmitModalDirect();
    fetchAssignments();
    fetchStats();
    showToast(data.status === "late" ? "⚠️ Submitted (late)." : "✅ Assignment submitted!");
  } catch (e) { showToast("❌ Submission failed."); }
}

// ─── SUBJECT BREAKDOWN (profile panel) ──────
function renderSubjectBreakdown() {
  const listEl = document.getElementById("subjectList");
  if (!listEl) return;
  if (!allAssignments.length) { listEl.innerHTML = `<p style="color:var(--text-dim);font-size:.82rem">No assignments yet</p>`; return; }

  const bySubject = {};
  allAssignments.forEach(a => {
    if (!bySubject[a.subject]) bySubject[a.subject] = 0;
    bySubject[a.subject]++;
  });

  listEl.innerHTML = Object.entries(bySubject).map(([subject, count]) => `
    <div class="subject-row">
      <span>${esc(subject)}</span>
      <span class="subject-row-count">${count}</span>
    </div>`).join("");

  const total = allAssignments.length;
  const completed = allAssignments.filter(a => {
    const sub = mySubmission(a);
    return sub && (sub.status === "submitted" || sub.status === "late");
  }).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const pf = document.getElementById("progressFill");
  const pp = document.getElementById("progressPercent");
  if (pf) pf.style.width = `${pct}%`;
  if (pp) pp.textContent = `${pct}%`;
}

// ─── GLOBAL CLICK DELEGATION ─────────────────
// Avoids building onclick="fn('${value}')" strings by hand (breaks on
// titles containing a quote) — every dynamic button uses data-action instead.
function setupGlobalClickDelegation() {
  document.body.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    if (el.dataset.action === "open-submit") openSubmitModal(el.dataset.id, el.dataset.title);
  });
}

// ─── HELPERS ─────────────────────────────────
function loadTheme() { const t = localStorage.getItem("appTheme") || "dark"; document.documentElement.setAttribute("data-theme", t); }
function esc(s) { const d = document.createElement("div"); d.appendChild(document.createTextNode(s ?? "")); return d.innerHTML; }
let toastTimer;
function showToast(msg) {
  const t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}