// Teacher Dashboard JS
let allAssignments = [], currentUser = null;
let gradeAssignmentId = null, gradeStudentId = null;

window.addEventListener("DOMContentLoaded", async () => {
  loadTheme();
  await checkAuth();
  loadSectionOptions();
  fetchAssignments();
  fetchStats();
  loadTeacherProfile();
  setupGlobalClickDelegation();
});

async function checkAuth() {
  const res = await fetch("/auth/me");
  if (!res.ok) { window.location.href = "/login.html"; return; }
  const user = await res.json();
  if (user.role !== "faculty") { window.location.href = "/login.html"; return; }
  currentUser = user;
  document.getElementById("welcomeName").textContent = `👋 ${currentUser.name}`;
}

async function logout() { await fetch("/auth/logout",{method:"POST"}); window.location.href = "/login.html"; }

async function fetchStats() {
  const [aRes, sRes] = await Promise.all([fetch("/assignments"),fetch("/students")]);
  const assignments = await aRes.json();
  const students = await sRes.json();
  const sections = [...new Set(students.map(s => s.section).filter(Boolean))];
  document.getElementById("stat-total").textContent = assignments.length;
  document.getElementById("stat-students").textContent = students.length;
  document.getElementById("stat-sections").textContent = sections.length;
}

async function loadSectionOptions() {
  const res = await fetch("/students/sections");
  const sections = await res.json();
  ["sectionFilter","trackerSection"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    sections.forEach(s => { const o = document.createElement("option"); o.value = s; o.textContent = `Section ${s}`; el.appendChild(o); });
  });
}

// ─── MANUAL SECTION ENTRY ──────────────────
// Shown when the teacher picks "Other" in the target-section dropdown on the
// assignment upload form, so they can type a section that isn't in the list.
function toggleCustomSection() {
  const select = document.getElementById("targetSection");
  const custom = document.getElementById("customSection");
  if (!select || !custom) return;
  if (select.value === "other") {
    custom.style.display = "block";
    custom.required = true;
    custom.focus();
  } else {
    custom.style.display = "none";
    custom.required = false;
    custom.value = "";
  }
}

// Resolve the section chosen in the assignment upload form,
// falling back to the manually typed value when "Other" is selected.
function resolveTargetSection() {
  const select = document.getElementById("targetSection");
  if (!select) return "";
  if (select.value === "other") {
    return document.getElementById("customSection").value.trim();
  }
  return select.value;
}

// ─── ASSIGNMENTS ───────────────────────────
document.getElementById("assignment-form").addEventListener("submit", async e => {
  e.preventDefault();
  const title = document.getElementById("title").value.trim();
  const subject = document.getElementById("subject").value.trim();
  const deadline = document.getElementById("deadline").value;
  const priority = document.getElementById("priority").value;
  const notes = document.getElementById("notes").value.trim();
  const section = resolveTargetSection();

  if (!title||!subject||!deadline) { showToast("⚠️ Fill required fields."); return; }
  if (document.getElementById("targetSection").value === "other" && !section) {
    showToast("⚠️ Please enter a section name.");
    return;
  }

  const res = await fetch("/assignments",{method:"POST",headers:{"Content-Type":"application/json"},
    body: JSON.stringify({title,subject,deadline,priority,notes,sections:section?[section]:[]})});
  if (!res.ok) { showToast("❌ Upload failed."); return; }
  document.getElementById("assignment-form").reset();
  toggleCustomSection();
  fetchAssignments();
  fetchStats();
  loadSectionOptions(); // pick up a brand-new manually-typed section in the filters
  showToast("✅ Assignment uploaded & students notified!");
});

async function fetchAssignments() {
  const res = await fetch("/assignments");
  allAssignments = await res.json();
  renderAssignments();
}

document.getElementById("search").addEventListener("input", renderAssignments);
document.getElementById("filter").addEventListener("change", renderAssignments);
document.getElementById("priorityFilter").addEventListener("change", renderAssignments);

function renderAssignments() {
  const q = document.getElementById("search").value.toLowerCase();
  const f = document.getElementById("filter").value;      // all | pending | submitted
  const p = document.getElementById("priorityFilter").value;

  let list = allAssignments.filter(a => a.title.toLowerCase().includes(q)||a.subject.toLowerCase().includes(q));
  if (p !== "all") list = list.filter(a => a.priority === p);
  if (f === "submitted") list = list.filter(a => (a.submissions?.length || 0) > 0);
  if (f === "pending") list = list.filter(a => (a.submissions?.length || 0) === 0);

  const container = document.getElementById("assignments-container");
  container.innerHTML = "";
  if (!list.length) { container.innerHTML = `<p class="empty-msg">No assignments found!</p>`; return; }
  list.forEach(a => container.appendChild(createAssignmentCard(a)));
}

function createAssignmentCard(a) {
  const deadline = new Date(a.deadline).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
  const submitted = a.submissions?.length || 0;
  const pColors = {high:"#ff6b6b",medium:"#ffd166",low:"#00e5a0"};
  const card = document.createElement("div");
  card.className = "assignment-card";
  card.style.borderLeftColor = pColors[a.priority];
  card.innerHTML = `
    <div class="card-info" style="padding-left:.5rem">
      <div class="card-title">${esc(a.title)}</div>
      <div class="card-meta">
        <span class="subject-badge">${esc(a.subject)}</span>
        <span class="deadline-text">📅 ${deadline}</span>
        <span class="priority-badge pri-${a.priority}">${{high:"🔴 High",medium:"🟡 Medium",low:"🟢 Low"}[a.priority]}</span>
        ${a.sections?.length ? `<span class="section-tag">Section ${a.sections.join(", ")}</span>` : `<span class="section-tag">All Sections</span>`}
        <span style="font-size:.72rem;color:var(--text-muted)">📤 ${submitted} submitted</span>
      </div>
      ${a.notes?`<div class="card-notes">📝 ${esc(a.notes)}</div>`:""}
    </div>
    <div class="card-actions">
      <button class="btn btn-notes" data-action="view-submissions" data-id="${esc(a._id)}" title="View Submissions">📊</button>
      <button class="btn btn-delete" data-action="delete-assignment" data-id="${esc(a._id)}">🗑</button>
    </div>`;
  return card;
}

async function deleteAssignment(id) {
  if (!confirm("Delete this assignment?")) return;
  await fetch(`/assignments/${id}`,{method:"DELETE"});
  fetchAssignments(); fetchStats();
  showToast("🗑️ Deleted.");
}

// ─── SECTIONS ──────────────────────────────
async function loadSections() {
  const section = document.getElementById("sectionFilter").value;
  const sortBy = document.getElementById("sortStudents").value;
  const minCpi = document.getElementById("minCpi").value;
  const maxCpi = document.getElementById("maxCpi").value;

  const res = await fetch(`/students/section-summary`);
  let data = await res.json();

  const container = document.getElementById("sectionsContainer");
  container.innerHTML = "";

  let sections = Object.entries(data);
  if (section) sections = sections.filter(([s]) => s === section);

  if (!sections.length) { container.innerHTML = `<p class="empty-msg">No students found.</p>`; return; }

  sections.sort(([a],[b]) => a.localeCompare(b)).forEach(([sec, info]) => {
    let students = info.students;
    if (minCpi) students = students.filter(s => s.cpi >= parseFloat(minCpi));
    if (maxCpi) students = students.filter(s => s.cpi <= parseFloat(maxCpi));
    if (sortBy === "cpi_desc") students.sort((a,b) => b.cpi - a.cpi);
    else if (sortBy === "cpi_asc") students.sort((a,b) => a.cpi - b.cpi);
    else if (sortBy === "name_asc") students.sort((a,b) => a.name.localeCompare(b.name));
    else if (sortBy === "submitted_desc") students.sort((a,b) => b.submitted - a.submitted);

    const avgCpi = students.length ? (students.reduce((s,st) => s + (st.cpi||0), 0) / students.length).toFixed(2) : 0;
    const totalSub = students.reduce((s,st) => s + st.submitted, 0);
    const totalPoss = students.length * (students[0]?.total || 0);
    const pct = totalPoss ? Math.round(totalSub/totalPoss*100) : 0;

    const div = document.createElement("div");
    div.className = "section-group";
    div.innerHTML = `
      <div class="section-head" data-action="toggle-section-body">
        <div class="section-head-title">🏫 Section ${esc(sec)} <span style="font-size:.78rem;color:var(--text-muted);font-weight:400">(${students.length} students)</span></div>
        <div class="section-stats">
          <span>Avg CPI: <strong style="color:var(--accent)">${avgCpi}</strong></span>
          <span>Submitted: <strong style="color:#00e5a0">${pct}%</strong></span>
        </div>
      </div>
      <div class="section-body">
        <div class="tracker-wrap">
          <table class="tracker-table">
            <thead><tr>
              <th>Student</th><th>Roll No</th><th>CPI</th><th>Submitted</th><th>Progress</th>
            </tr></thead>
            <tbody>${students.map(s => `
              <tr>
                <td><div class="student-row-name" style="cursor:pointer;color:var(--accent)" data-action="open-student" data-id="${esc(s._id)}" data-name="${esc(s.name)}">${esc(s.name)}</div><div style="font-size:.7rem;color:var(--text-muted)">${esc(s.email||"")}</div></td>
                <td>${esc(s.rollNumber||"-")}</td>
                <td><span class="cpi-badge">${s.cpi||0}</span></td>
                <td>${s.submitted}/${s.total}</td>
                <td style="min-width:80px">
                  <div style="font-size:.7rem;color:var(--text-muted)">${s.percentage}%</div>
                  <div class="progress-mini"><div class="progress-mini-fill" style="width:${s.percentage}%"></div></div>
                </td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
    container.appendChild(div);
  });
}

// ─── TRACKER ───────────────────────────────
async function loadTracker() {
  const section = document.getElementById("trackerSection").value;
  const url = `/students/tracker${section ? `?section=${encodeURIComponent(section)}` : ""}`;
  const res = await fetch(url);
  const { tracker, assignments } = await res.json();

  const container = document.getElementById("trackerContainer");
  if (!tracker.length) { container.innerHTML = `<p class="empty-msg">No students found.</p>`; return; }

  container.innerHTML = `
    <div class="tracker-wrap">
      <table class="tracker-table">
        <thead><tr>
          <th>Student</th><th>Section</th><th>CPI</th>
          ${assignments.map(a => `<th title="${esc(a.title)}">${esc(a.title.substring(0,12))}${a.title.length>12?"...":""}</th>`).join("")}
          <th>Total</th>
        </tr></thead>
        <tbody>${tracker.map(row => `
          <tr>
            <td><div class="student-row-name" style="cursor:pointer;color:var(--accent)" data-action="open-student" data-id="${esc(row.student._id)}" data-name="${esc(row.student.name)}">${esc(row.student.name)}</div></td>
            <td><span class="section-tag">${esc(row.student.section||"-")}</span></td>
            <td><span class="cpi-badge">${row.student.cpi||0}</span></td>
            ${assignments.map(a => {
              const sub = row.submissions[a._id.toString()];
              const status = sub?.status || "pending";
              const cls = status==="submitted"?"sub-submitted":status==="late"?"sub-late":"sub-pending";
              const label = status==="submitted"?"✓":status==="late"?"Late":"—";
              const hasGrade = sub?.grade;
              return `<td>
                <span class="sub-pill ${cls}">${label}</span>
                ${hasGrade ? `<div style="font-size:.65rem;color:#00e5a0;margin-top:2px">📝 ${esc(sub.grade)}</div>` : ""}
                ${sub?.fileName ? `<button class="btn btn-notes" style="font-size:.65rem;padding:2px 6px;margin-top:3px" data-action="open-grade" data-assignment-id="${esc(a._id)}" data-student-id="${esc(row.student._id)}" data-student-name="${esc(row.student.name)}">Grade</button>` : ""}
              </td>`;
            }).join("")}
            <td><strong>${row.totalSubmitted}/${row.totalAssignments}</strong></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

// View submissions for an assignment
async function viewSubmissions(assignmentId) {
  showPanel("tracker");
  setTimeout(() => loadTracker(), 100);
}

// ─── GRADE MODAL ───────────────────────────
function openGradeModal(assignmentId, studentId, studentName) {
  gradeAssignmentId = assignmentId;
  gradeStudentId    = studentId;
  document.getElementById("gradeModalTitle").textContent = "Give Grade & Remarks";
  document.getElementById("gradeStudentName").textContent = `Student: ${studentName}`;
  document.getElementById("gradeInput").value   = "";
  document.getElementById("remarksInput").value = "";
  document.getElementById("gradeModal").classList.add("open");
}
function closeGradeModalDirect() { document.getElementById("gradeModal").classList.remove("open"); }
function closeGradeModal(e) { if(e.target.id==="gradeModal") closeGradeModalDirect(); }

async function submitGrade() {
  const grade   = document.getElementById("gradeInput").value.trim();
  const remarks = document.getElementById("remarksInput").value.trim();
  if (!grade) { showToast("⚠️ Enter a grade."); return; }
  const res = await fetch(`/assignments/${gradeAssignmentId}/grade/${gradeStudentId}`,{
    method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({grade,remarks})});
  if (!res.ok) { showToast("❌ Failed."); return; }
  closeGradeModalDirect();
  loadTracker();
  showToast("✅ Grade saved!");
}

// ─── PANEL SWITCHING ───────────────────────
function showPanel(name) {
  document.querySelectorAll(".section-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
  document.getElementById(`panel-${name}`).classList.add("active");
  const idx = {assignments:0,sections:1,tracker:2}[name];
  document.querySelectorAll(".nav-tab")[idx].classList.add("active");
  if (name === "sections") loadSections();
  if (name === "tracker") loadTracker();
}

// ─── GLOBAL CLICK DELEGATION ────────────────
// Instead of building onclick="fn('${value}')" strings (which break if a
// title/name contains a quote), every dynamic button carries data-action +
// data-* attributes and we handle all clicks from one delegated listener.
function setupGlobalClickDelegation() {
  document.body.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;

    if (action === "view-submissions") viewSubmissions(el.dataset.id);
    else if (action === "delete-assignment") deleteAssignment(el.dataset.id);
    else if (action === "open-student") openStudentDetails(el.dataset.id, el.dataset.name);
    else if (action === "open-grade") openGradeModal(el.dataset.assignmentId, el.dataset.studentId, el.dataset.studentName);
    else if (action === "toggle-section-body") {
      const body = el.nextElementSibling;
      body.style.display = body.style.display === "none" ? "block" : "none";
    }
  });
}

// ─── HELPERS ───────────────────────────────
function loadTheme() { const t=localStorage.getItem("appTheme")||"dark"; document.documentElement.setAttribute("data-theme",t); }
function esc(s) { const d=document.createElement("div"); d.appendChild(document.createTextNode(s??"")); return d.innerHTML; }
let toastTimer;
function showToast(msg) {
  const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),2800);
}

// Load teacher full profile from DB
async function loadTeacherProfile() {
  try {
    const res = await fetch("/auth/me");
    if (!res.ok) return;
    const s = await res.json();

    // Profile panel header
    const dn = document.getElementById("displayName");
    const hn = document.getElementById("headerName");
    const dc = document.getElementById("displayCollege");

    if (dn) dn.textContent = s.name || "Your Name";
    if (hn) hn.textContent = s.name || "My Profile";

    // Show all details in college area
    if (dc) {
      dc.innerHTML = `
        <div style="font-size:.78rem;color:var(--text-muted);margin-top:2px;line-height:1.8">
          ${s.email    ? `📧 ${esc(s.email)}<br>`    : ""}
          ${s.branch   ? `🌿 ${esc(s.branch)}<br>`   : ""}
          ${s.year     ? `📅 ${esc(s.year)}<br>`     : ""}
          ${s.username ? `👤 @${esc(s.username)}`    : ""}
        </div>`;
    }

    // Pre-fill edit form
    const fields = {
      inputName:     s.name,
      inputEmail:    s.email,
      inputBranch:   s.branch,
      inputYear:     s.year,
      inputUsername: s.username
    };
    Object.entries(fields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    });

    loadPhoto();
    updateLastActivity();
  } catch(e) {
    console.error("Teacher profile error:", e);
  }
}

// ─── STUDENT DETAILS MODAL ─────────────────
async function openStudentDetails(studentId, studentName) {
  document.getElementById("studentModalTitle").textContent = `👨‍🎓 ${studentName}`;
  document.getElementById("studentModal").classList.add("open");

  try {
    const res  = await fetch(`/students/${studentId}/details`);
    const data = await res.json();
    const { student, submissionDetails, stats, teacherSubject } = data;

    // ── Info Grid ──
    const infoGrid = document.getElementById("studentInfoGrid");
    infoGrid.innerHTML = [
      { icon:"📧", label:"Email",      val: student.email      || "-" },
      { icon:"🏫", label:"Section",    val: student.section    || "-" },
      { icon:"🔢", label:"Roll No",    val: student.rollNumber || "-" },
      { icon:"⭐", label:"CPI/CGPA",   val: student.cpi        || "-" },
      { icon:"📅", label:"Year",       val: student.year       || "-" },
      { icon:"🌿", label:"Branch",     val: student.branch     || "-" },
    ].map(item => `
      <div style="background:var(--glass);border:1px solid var(--glass-border);border-radius:10px;padding:.65rem .9rem">
        <div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">${item.icon} ${item.label}</div>
        <div style="font-weight:600;font-size:.88rem">${esc(String(item.val))}</div>
      </div>`).join("");

    // ── Stats ──
    const statsGrid = document.getElementById("studentStatsGrid");
    statsGrid.innerHTML = [
      { label:"Total",     val: stats.total,     color:"var(--accent)" },
      { label:"Submitted", val: stats.submitted, color:"var(--green)"  },
      { label:"Pending",   val: stats.pending,   color:"var(--yellow)" },
    ].map(s => `
      <div style="background:var(--glass);border:1px solid var(--glass-border);border-radius:10px;padding:.75rem;text-align:center">
        <div style="font-size:1.4rem;font-weight:700;color:${s.color};font-family:'Space Mono',monospace">${s.val}</div>
        <div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-top:2px">${s.label}</div>
      </div>`).join("");

    // ── Progress ──
    document.getElementById("studentProgressFill").style.width = `${stats.percentage}%`;
    document.getElementById("studentProgressPct").textContent  = `${stats.percentage}%`;

    // ── Subject Label ──
    const subLabel = document.getElementById("subjectLabel");
    subLabel.textContent = teacherSubject
      ? `📚 ${teacherSubject} — Assignment Submissions`
      : "📚 All Assignment Submissions";

    // ── Assignment List ──
    const list = document.getElementById("studentAssignmentList");
    if (!submissionDetails.length) {
      list.innerHTML = `<p class="empty-msg" style="padding:1rem">No assignments found.</p>`;
      return;
    }

    list.innerHTML = submissionDetails.map(s => {
      const deadline   = new Date(s.deadline).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
      const statusCls  = s.status==="submitted" ? "sub-submitted" : s.status==="late" ? "sub-late" : "sub-pending";
      const statusLabel= s.status==="submitted" ? "✓ Submitted" : s.status==="late" ? "⚠ Late" : "— Pending";

      return `
        <div style="background:var(--glass);border:1px solid var(--glass-border);border-radius:12px;padding:.9rem 1rem;margin-bottom:.6rem">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
            <div>
              <div style="font-weight:600;font-size:.88rem">${esc(s.assignmentTitle)}</div>
              <div style="font-size:.75rem;color:var(--text-muted);margin-top:3px">
                <span class="subject-badge" style="font-size:.65rem">${esc(s.subject)}</span>
                <span style="margin-left:.4rem">📅 ${deadline}</span>
                ${s.fileName ? `<span style="margin-left:.4rem">📎 ${esc(s.fileName)}</span>` : ""}
              </div>
            </div>
            <span class="sub-pill ${statusCls}">${statusLabel}</span>
          </div>
          ${s.grade ? `
            <div style="margin-top:.6rem;padding:.5rem .75rem;background:rgba(0,229,160,.06);border:1px solid rgba(0,229,160,.2);border-radius:8px;font-size:.8rem">
              <strong style="color:var(--green)">Grade: ${esc(s.grade)}</strong>
              ${s.remarks ? `<span style="color:var(--text-muted);margin-left:.5rem">— ${esc(s.remarks)}</span>` : ""}
            </div>` : `
            <div style="margin-top:.5rem">
              <button class="btn btn-notes" style="font-size:.72rem;padding:3px 10px"
                data-action="open-grade" data-assignment-id="${esc(s.assignmentId)}" data-student-id="${esc(student._id)}" data-student-name="${esc(student.name)}">
                📝 Give Grade
              </button>
            </div>`}
        </div>`;
    }).join("");

  } catch(e) {
    document.getElementById("studentModalContent").innerHTML = `<p style="color:var(--red)">Failed to load student details.</p>`;
  }
}

function closeStudentModalDirect() { document.getElementById("studentModal").classList.remove("open"); }
function closeStudentModal(e) { if(e.target.id==="studentModal") closeStudentModalDirect(); }