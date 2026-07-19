// ============================================
//  Student Assignment Tracker — Full Script
//  Features: CRUD, Calendar, Notes, Priority,
//            Browser Notifications, Themes, Profile
// ============================================

const API = "http://localhost:3000";

// DOM refs
const form           = document.getElementById("assignment-form");
const titleInput     = document.getElementById("title");
const subjectInput   = document.getElementById("subject");
const deadlineInput  = document.getElementById("deadline");
const priorityInput  = document.getElementById("priority");
const notesInput     = document.getElementById("notes");
const searchInput    = document.getElementById("search");
const filterSelect   = document.getElementById("filter");
const priorityFilter = document.getElementById("priorityFilter");
const container      = document.getElementById("assignments-container");
const toast          = document.getElementById("toast");

let allAssignments = [];
let currentView    = "list";
let calYear, calMonth;
let editingId      = null; // for notes modal

// Quotes
const quotes = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
  { text: "Education is the most powerful weapon to change the world.", author: "Nelson Mandela" }
];
let quoteIdx = 0;

// =============================================
//  INIT
// =============================================
window.addEventListener("DOMContentLoaded", () => {
  const now = new Date();
  calYear   = now.getFullYear();
  calMonth  = now.getMonth();

  loadTheme();
  loadProfile();
  loadPhoto();

  const saved = localStorage.getItem("lastActivity");
  if (saved) document.getElementById("lastActivity").textContent = `Last active: ${saved}`;

  quoteIdx = Math.floor(Math.random() * quotes.length);
  document.getElementById("quoteText").textContent   = `"${quotes[quoteIdx].text}"`;
  document.getElementById("quoteAuthor").textContent = `— ${quotes[quoteIdx].author}`;

  checkNotifPermission();
  fetchAssignments();
  fetchDashboard();
  scheduleNotifCheck();
});

// =============================================
//  FETCH
// =============================================
async function fetchAssignments() {
  try {
    const res = await fetch(`${API}/assignments`);
    allAssignments = await res.json();
    renderCurrent();
    updateProfileStats();
    updateLastActivity();
  } catch {
    showToast("❌ Cannot connect to server.");
  }
}

async function fetchDashboard() {
  try {
    const res  = await fetch(`${API}/dashboard`);
    const data = await res.json();
    document.getElementById("stat-total").textContent     = data.total;
    document.getElementById("stat-completed").textContent = data.completed;
    document.getElementById("stat-pending").textContent   = data.pending;
  } catch {}
}

// =============================================
//  ADD
// =============================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title    = titleInput.value.trim();
  const subject  = subjectInput.value.trim();
  const deadline = deadlineInput.value;
  const priority = priorityInput.value;
  const notes    = notesInput.value.trim();

  if (!title || !subject || !deadline) { showToast("⚠️ Fill all required fields."); return; }

  try {
    await fetch(`${API}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, subject, deadline, priority, notes })
    });
    form.reset();
    priorityInput.value = "medium";
    fetchAssignments();
    fetchDashboard();
    showToast("✅ Assignment added!");
  } catch { showToast("❌ Failed to add."); }
});

// =============================================
//  TOGGLE COMPLETE
// =============================================
async function toggleComplete(id) {
  try {
    await fetch(`${API}/assignments/${id}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: "{}" });
    fetchAssignments();
    fetchDashboard();
    showToast("🔄 Status updated!");
  } catch { showToast("❌ Failed to update."); }
}

// =============================================
//  DELETE
// =============================================
async function deleteAssignment(id) {
  if (!confirm("Delete this assignment?")) return;
  try {
    await fetch(`${API}/assignments/${id}`, { method: "DELETE" });
    fetchAssignments();
    fetchDashboard();
    showToast("🗑️ Deleted.");
  } catch { showToast("❌ Failed to delete."); }
}

// =============================================
//  NOTES MODAL
// =============================================
function openNotesModal(id) {
  const a = allAssignments.find(x => x.id === id);
  if (!a) return;
  editingId = id;
  document.getElementById("modalTitle").textContent    = `📝 ${a.title}`;
  document.getElementById("modalNotes").value          = a.notes || "";
  document.getElementById("modalPriority").value       = a.priority || "medium";
  document.getElementById("notesModal").classList.add("open");
}

function closeNotesModalDirect() {
  document.getElementById("notesModal").classList.remove("open");
  editingId = null;
}

function closeNotesModal(e) {
  if (e.target.id === "notesModal") closeNotesModalDirect();
}

async function saveNotes() {
  if (!editingId) return;
  const notes    = document.getElementById("modalNotes").value.trim();
  const priority = document.getElementById("modalPriority").value;
  try {
    await fetch(`${API}/assignments/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, priority })
    });
    closeNotesModalDirect();
    fetchAssignments();
    showToast("💾 Notes saved!");
  } catch { showToast("❌ Failed to save notes."); }
}

// =============================================
//  VIEW SWITCHING
// =============================================
function switchView(view) {
  currentView = view;
  document.getElementById("listView").style.display     = view === "list"     ? "block" : "none";
  document.getElementById("calendarView").style.display = view === "calendar" ? "block" : "none";
  document.getElementById("btn-list").classList.toggle("active",     view === "list");
  document.getElementById("btn-calendar").classList.toggle("active", view === "calendar");
  if (view === "calendar") renderCalendar();
}

function renderCurrent() {
  if (currentView === "list") renderAssignments();
  else renderCalendar();
}

// =============================================
//  LIST RENDER
// =============================================
searchInput.addEventListener("input", renderAssignments);
filterSelect.addEventListener("change", renderAssignments);
priorityFilter.addEventListener("change", renderAssignments);

function renderAssignments() {
  const query   = searchInput.value.toLowerCase();
  const fVal    = filterSelect.value;
  const pVal    = priorityFilter.value;

  let filtered = allAssignments.filter(a =>
    a.title.toLowerCase().includes(query) ||
    a.subject.toLowerCase().includes(query)
  );
  if (fVal !== "all") filtered = filtered.filter(a => fVal === "completed" ? a.completed : !a.completed);
  if (pVal !== "all") filtered = filtered.filter(a => a.priority === pVal);

  filtered.sort((a, b) => {
    const po = { high:0, medium:1, low:2 };
    if (!a.completed && !b.completed) {
      if (po[a.priority] !== po[b.priority]) return po[a.priority] - po[b.priority];
    }
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  container.innerHTML = "";
  if (!filtered.length) {
    container.innerHTML = `<p class="empty-msg">No assignments found!</p>`; return;
  }
  filtered.forEach(a => container.appendChild(createCard(a)));
}

function createCard(a) {
  const { id, title, subject, deadline, completed, priority, notes } = a;
  const status = getDeadlineStatus(deadline, completed);
  const pLabel = { high:"🔴 High", medium:"🟡 Medium", low:"🟢 Low" };
  const formattedDate = new Date(deadline + "T00:00:00").toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });

  const pillMap = {
    completed: `<span class="status-pill pill-completed">✓ Done</span>`,
    overdue:   `<span class="status-pill pill-overdue">⚠ Overdue</span>`,
    near:      `<span class="status-pill pill-near">⏰ Due Soon</span>`,
    normal:    `<span class="status-pill pill-normal">Pending</span>`
  };

  const doneBtn = completed
    ? `<button class="btn btn-undo"  onclick="toggleComplete('${id}')">Undo</button>`
    : `<button class="btn btn-done"  onclick="toggleComplete('${id}')">✓ Done</button>`;

  const card = document.createElement("div");
  card.className = `assignment-card status-${status} pri-card-${priority || "medium"}`;
  card.innerHTML = `
    <div class="card-info">
      <div class="card-title">${escapeHtml(title)}</div>
      <div class="card-meta">
        <span class="subject-badge">${escapeHtml(subject)}</span>
        <span class="deadline-text">📅 ${formattedDate}</span>
        <span class="priority-badge pri-${priority||"medium"}">${pLabel[priority||"medium"]}</span>
        ${pillMap[status]}
      </div>
      ${notes ? `<div class="card-notes">📝 ${escapeHtml(notes)}</div>` : ""}
    </div>
    <div class="card-actions">
      <button class="btn btn-notes" onclick="openNotesModal('${id}')" title="Notes & Priority">📝</button>
      ${doneBtn}
      <button class="btn btn-delete" onclick="deleteAssignment('${id}')">🗑</button>
    </div>`;
  return card;
}

// =============================================
//  CALENDAR RENDER
// =============================================
function changeMonth(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderCalendar();
}

function renderCalendar() {
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  document.getElementById("calMonthLabel").textContent = `${months[calMonth]} ${calYear}`;

  const today      = new Date();
  const firstDay   = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth= new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev = new Date(calYear, calMonth, 0).getDate();

  // Build event map: "YYYY-MM-DD" -> [assignments]
  const eventMap = {};
  allAssignments.forEach(a => {
    if (!eventMap[a.deadline]) eventMap[a.deadline] = [];
    eventMap[a.deadline].push(a);
  });

  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = `
    <div class="cal-weekdays">
      ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => `<div class="cal-weekday">${d}</div>`).join("")}
    </div>
    <div class="cal-days" id="calDays"></div>`;

  const calDays = document.getElementById("calDays");

  // Prev month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = document.createElement("div");
    d.className = "cal-day other-month";
    d.innerHTML = `<div class="day-num">${daysInPrev - i}</div>`;
    calDays.appendChild(d);
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const mm    = String(calMonth + 1).padStart(2, "0");
    const dd    = String(day).padStart(2, "0");
    const dateKey = `${calYear}-${mm}-${dd}`;
    const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day;

    const d = document.createElement("div");
    d.className = `cal-day${isToday ? " today" : ""}`;

    let eventsHTML = "";
    if (eventMap[dateKey]) {
      eventMap[dateKey].slice(0, 3).forEach(a => {
        const cls = a.completed ? "ev-done" : `ev-${a.priority || "medium"}`;
        eventsHTML += `<div class="cal-event ${cls}" title="${escapeHtml(a.title)}" onclick="openNotesModal('${a.id}')">${escapeHtml(a.title)}</div>`;
      });
      if (eventMap[dateKey].length > 3) eventsHTML += `<div style="font-size:0.6rem;color:var(--text-dim)">+${eventMap[dateKey].length - 3} more</div>`;
    }

    d.innerHTML = `<div class="day-num">${day}</div>${eventsHTML}`;
    calDays.appendChild(d);
  }

  // Next month padding
  const totalCells = firstDay + daysInMonth;
  const remaining  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    const d = document.createElement("div");
    d.className = "cal-day other-month";
    d.innerHTML = `<div class="day-num">${i}</div>`;
    calDays.appendChild(d);
  }
}

// =============================================
//  BROWSER NOTIFICATIONS
// =============================================
function checkNotifPermission() {
  if (!("Notification" in window)) {
    document.getElementById("notifBtn").disabled = true;
    setNotifStatus("Browser notifications not supported.", "err");
    return;
  }
  if (Notification.permission === "granted") {
    document.getElementById("notifBtn").textContent = "✅ Notifications Enabled";
    document.getElementById("notifBtn").disabled    = true;
    setNotifStatus("You will get reminders for due assignments!", "ok");
  } else if (Notification.permission === "denied") {
    document.getElementById("notifBtn").disabled = true;
    setNotifStatus("Notifications blocked. Allow in browser settings.", "err");
  }
}

async function requestNotifPermission() {
  if (!("Notification" in window)) return;
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    document.getElementById("notifBtn").textContent = "✅ Notifications Enabled";
    document.getElementById("notifBtn").disabled    = true;
    setNotifStatus("Reminders enabled! 🎉", "ok");
    showToast("🔔 Notifications enabled!");
    checkAndNotify();
  } else {
    setNotifStatus("Permission denied.", "err");
    showToast("❌ Notifications blocked.");
  }
}

function setNotifStatus(msg, type) {
  const el = document.getElementById("notifStatus");
  el.textContent  = msg;
  el.className    = `notif-status ${type}`;
}

function checkAndNotify() {
  if (Notification.permission !== "granted") return;
  const today = new Date(); today.setHours(0,0,0,0);

  allAssignments.filter(a => !a.completed).forEach(a => {
    const due  = new Date(a.deadline + "T00:00:00");
    const diff = Math.ceil((due - today) / 86400000);
    if (diff >= 0 && diff <= 2) {
      const msg = diff === 0 ? "Due TODAY!" : `Due in ${diff} day${diff > 1 ? "s" : ""}!`;
      new Notification(`📚 AssignTrack Reminder`, {
        body: `${a.title} (${a.subject}) — ${msg}`,
        icon: "https://cdn-icons-png.flaticon.com/512/3767/3767084.png"
      });
    }
  });
}

// Check for notifications every 6 hours
function scheduleNotifCheck() {
  setInterval(() => { if (Notification.permission === "granted") checkAndNotify(); }, 6 * 60 * 60 * 1000);
  // Also check once on load after short delay
  setTimeout(() => { if (Notification.permission === "granted") checkAndNotify(); }, 3000);
}

// =============================================
//  PROFILE
// =============================================
function toggleProfile() {
  const panel = document.getElementById("profilePanel");
  const arrow = document.getElementById("profileArrow");
  const isOpen = panel.classList.contains("open");
  panel.classList.toggle("open");
  arrow.classList.toggle("open", !isOpen);
}

function saveProfile() {
  const name    = document.getElementById("inputName").value.trim();
  const college = document.getElementById("inputCollege").value.trim();
  const branch  = document.getElementById("inputBranch").value.trim();
  const year    = document.getElementById("inputYear").value.trim();
  if (!name) { showToast("⚠️ Please enter your name!"); return; }
  localStorage.setItem("studentProfile", JSON.stringify({ name, college, branch, year }));
  updateProfileDisplay({ name, college, branch, year });
  showToast("✅ Profile saved!");
}

function updateProfileDisplay({ name, college, branch, year }) {
  document.getElementById("displayName").textContent   = name    || "Your Name";
  document.getElementById("headerName").textContent    = name    || "My Profile";
  let ct = college || "College Name";
  if (branch) ct += ` • ${branch}`;
  if (year)   ct += ` • ${year}`;
  document.getElementById("displayCollege").textContent = ct;
  if (name)    document.getElementById("inputName").value    = name;
  if (college) document.getElementById("inputCollege").value = college;
  if (branch)  document.getElementById("inputBranch").value  = branch;
  if (year)    document.getElementById("inputYear").value    = year;
}

function loadProfile() {
  const s = localStorage.getItem("studentProfile");
  if (s) updateProfileDisplay(JSON.parse(s));
}

function handlePhotoUpload(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = (ev) => { localStorage.setItem("studentPhoto", ev.target.result); setAvatarPhoto(ev.target.result); };
  r.readAsDataURL(file);
}
function setAvatarPhoto(src) {
  document.getElementById("avatarDisplay").innerHTML = `<img src="${src}" alt="Photo"/>`;
  document.getElementById("headerAvatar").innerHTML  = `<img src="${src}" alt="Photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
}
function loadPhoto() {
  const s = localStorage.getItem("studentPhoto"); if (s) setAvatarPhoto(s);
}

function updateProfileStats() {
  const total     = allAssignments.length;
  const completed = allAssignments.filter(a => a.completed).length;
  const pct       = total === 0 ? 0 : Math.round((completed / total) * 100);
  document.getElementById("progressFill").style.width    = `${pct}%`;
  document.getElementById("progressPercent").textContent = `${pct}%`;
  updateBadge(total, completed);
  updateSubjectStats(allAssignments);
}

function updateBadge(total, completed) {
  const icon  = document.getElementById("badgeIcon");
  const label = document.getElementById("badgeLabel");
  const badge = document.getElementById("perfBadge");
  if (total === 0) { icon.textContent = "🚀"; label.textContent = "Getting Started"; return; }
  const pct = Math.round((completed / total) * 100);
  if (pct >= 80) { icon.textContent = "🏆"; label.textContent = "Excellent Student!"; label.style.color = "var(--green)"; badge.style.borderColor = "rgba(0,229,160,0.4)"; }
  else if (pct >= 50) { icon.textContent = "⭐"; label.textContent = "Good Progress!"; label.style.color = "var(--accent)"; badge.style.borderColor = "rgba(124,111,255,0.4)"; }
  else if (pct >= 20) { icon.textContent = "📖"; label.textContent = "Keep Going!"; label.style.color = "var(--yellow)"; badge.style.borderColor = "rgba(255,209,102,0.4)"; }
  else { icon.textContent = "💪"; label.textContent = "Just Starting!"; label.style.color = "var(--red)"; badge.style.borderColor = "rgba(255,107,107,0.3)"; }
}

function updateSubjectStats(assignments) {
  const el = document.getElementById("subjectList");
  if (!assignments.length) { el.innerHTML = `<p style="color:var(--text-dim);font-size:0.82rem">No assignments yet</p>`; return; }
  const map = {};
  assignments.forEach(a => {
    if (!map[a.subject]) map[a.subject] = { total:0, done:0 };
    map[a.subject].total++;
    if (a.completed) map[a.subject].done++;
  });
  el.innerHTML = Object.entries(map).map(([s, v]) =>
    `<div class="subject-row"><span class="subject-row-name">${escapeHtml(s)}</span><span class="subject-row-count">${v.done}/${v.total}</span></div>`
  ).join("");
}

function updateLastActivity() {
  const f = new Date().toLocaleString("en-IN", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });
  document.getElementById("lastActivity").textContent = `Last active: ${f}`;
  localStorage.setItem("lastActivity", f);
}

// =============================================
//  THEME SWITCHER
// =============================================
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("appTheme", theme);
  document.querySelectorAll(".theme-btn").forEach(b => b.classList.remove("active"));
  const btn = document.getElementById(`theme-${theme}`);
  if (btn) btn.classList.add("active");
  const names = { dark:"🌌 Dark Purple", sunset:"🌅 Sunset", pastel:"🌸 Pastel Floral", ocean:"🌊 Ocean Blue" };
  showToast(`Theme: ${names[theme]}`);
}

function loadTheme() {
  const t = localStorage.getItem("appTheme") || "dark";
  document.documentElement.setAttribute("data-theme", t);
  document.querySelectorAll(".theme-btn").forEach(b => b.classList.remove("active"));
  const btn = document.getElementById(`theme-${t}`);
  if (btn) btn.classList.add("active");
}

// =============================================
//  QUOTE
// =============================================
function refreshQuote() {
  quoteIdx = (quoteIdx + 1) % quotes.length;
  document.getElementById("quoteText").textContent   = `"${quotes[quoteIdx].text}"`;
  document.getElementById("quoteAuthor").textContent = `— ${quotes[quoteIdx].author}`;
}

// =============================================
//  HELPERS
// =============================================
function getDeadlineStatus(deadline, completed) {
  if (completed) return "completed";
  const today = new Date(); today.setHours(0,0,0,0);
  const due   = new Date(deadline + "T00:00:00");
  const diff  = Math.ceil((due - today) / 86400000);
  if (diff < 0)  return "overdue";
  if (diff <= 3) return "near";
  return "normal";
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}