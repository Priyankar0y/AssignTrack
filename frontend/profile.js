// ============================================
//  Profile Panel & Theme Switcher
//  Include in both teacher.html & student.html
// ============================================

const quotes = [
  {text:"The secret of getting ahead is getting started.",author:"Mark Twain"},
  {text:"It always seems impossible until it's done.",author:"Nelson Mandela"},
  {text:"Hard work beats talent when talent doesn't work hard.",author:"Tim Notke"},
  {text:"Push yourself, because no one else is going to do it for you.",author:"Unknown"},
  {text:"Education is the most powerful weapon to change the world.",author:"Nelson Mandela"},
  {text:"Don't watch the clock; do what it does. Keep going.",author:"Sam Levenson"},
  {text:"Believe you can and you're halfway there.",author:"Theodore Roosevelt"},
  {text:"Success is the sum of small efforts repeated day in and day out.",author:"Robert Collier"}
];
let quoteIdx = Math.floor(Math.random() * quotes.length);

function initProfile() {
  loadTheme();
  loadProfileData();
  loadPhoto();
  setQuote();
  updateLastActivity();
}

function toggleProfile() {
  const panel = document.getElementById("profilePanel");
  const arrow = document.getElementById("profileArrow");
  const isOpen = panel.classList.contains("open");
  panel.classList.toggle("open");
  arrow.classList.toggle("open", !isOpen);
}

function setQuote() {
  const q = quotes[quoteIdx];
  const qt = document.getElementById("quoteText");
  const qa = document.getElementById("quoteAuthor");
  if(qt) qt.textContent = `"${q.text}"`;
  if(qa) qa.textContent = `— ${q.author}`;
}

function refreshQuote() {
  quoteIdx = (quoteIdx + 1) % quotes.length;
  setQuote();
}

// ── THEME ────────────────────────────────
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("appTheme", theme);
  document.querySelectorAll(".theme-btn").forEach(b => b.classList.remove("active"));
  const btn = document.getElementById(`theme-${theme}`);
  if(btn) btn.classList.add("active");
  const names = {dark:"🌌 Dark Purple",sunset:"🌅 Sunset",pastel:"🌸 Pastel Floral",ocean:"🌊 Ocean Blue"};
  showToast(`Theme: ${names[theme]}`);
}

function loadTheme() {
  const t = localStorage.getItem("appTheme") || "dark";
  document.documentElement.setAttribute("data-theme", t);
  setTimeout(() => {
    document.querySelectorAll(".theme-btn").forEach(b => b.classList.remove("active"));
    const btn = document.getElementById(`theme-${t}`);
    if(btn) btn.classList.add("active");
  }, 100);
}

// ── PROFILE SAVE ─────────────────────────
function saveProfile() {
  const name    = document.getElementById("inputName")?.value.trim();
  const college = document.getElementById("inputCollege")?.value.trim();
  const branch  = document.getElementById("inputBranch")?.value.trim();
  const year    = document.getElementById("inputYear")?.value.trim();
  if(!name) { showToast("⚠️ Please enter your name!"); return; }
  const profile = {name, college, branch, year};
  localStorage.setItem("studentProfile", JSON.stringify(profile));
  updateProfileDisplay(profile);
  showToast("✅ Profile saved!");
}

function updateProfileDisplay(profile) {
  const {name, college, branch, year} = profile;
  const dn = document.getElementById("displayName");
  const hn = document.getElementById("headerName");
  const dc = document.getElementById("displayCollege");
  if(dn) dn.textContent = name || "Your Name";
  if(hn) hn.textContent = name || "My Profile";
  let ct = college || "College Name";
  if(branch) ct += ` • ${branch}`;
  if(year)   ct += ` • ${year}`;
  if(dc) dc.textContent = ct;
  if(name)    { const el=document.getElementById("inputName");    if(el) el.value=name; }
  if(college) { const el=document.getElementById("inputCollege"); if(el) el.value=college; }
  if(branch)  { const el=document.getElementById("inputBranch");  if(el) el.value=branch; }
  if(year)    { const el=document.getElementById("inputYear");    if(el) el.value=year; }
}

function loadProfileData() {
  const s = localStorage.getItem("studentProfile");
  if(s) updateProfileDisplay(JSON.parse(s));
}

// ── PHOTO ────────────────────────────────
function handlePhotoUpload(e) {
  const file = e.target.files[0]; if(!file) return;
  const r = new FileReader();
  r.onload = (ev) => { localStorage.setItem("studentPhoto", ev.target.result); setAvatarPhoto(ev.target.result); };
  r.readAsDataURL(file);
}

function setAvatarPhoto(src) {
  const large = document.getElementById("avatarDisplay");
  const small = document.getElementById("headerAvatar");
  if(large) large.innerHTML = `<img src="${src}" alt="Photo"/>`;
  if(small) small.innerHTML = `<img src="${src}" alt="Photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
}

function loadPhoto() {
  const s = localStorage.getItem("studentPhoto");
  if(s) setAvatarPhoto(s);
}

// ── PROGRESS & BADGE ─────────────────────
function updateProfileStats(total, completed) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const pf  = document.getElementById("progressFill");
  const pp  = document.getElementById("progressPercent");
  if(pf) pf.style.width = `${pct}%`;
  if(pp) pp.textContent = `${pct}%`;
  updateBadge(total, completed);
}

function updateBadge(total, completed) {
  const icon  = document.getElementById("badgeIcon");
  const label = document.getElementById("badgeLabel");
  const badge = document.getElementById("perfBadge");
  if(!icon||!label) return;
  if(total===0){ icon.textContent="🚀"; label.textContent="Getting Started"; return; }
  const pct = Math.round((completed/total)*100);
  if(pct>=80){ icon.textContent="🏆"; label.textContent="Excellent!"; label.style.color="var(--green)"; if(badge) badge.style.borderColor="rgba(0,229,160,.4)"; }
  else if(pct>=50){ icon.textContent="⭐"; label.textContent="Good Progress!"; label.style.color="var(--accent)"; if(badge) badge.style.borderColor="rgba(124,111,255,.4)"; }
  else if(pct>=20){ icon.textContent="📖"; label.textContent="Keep Going!"; label.style.color="var(--yellow)"; if(badge) badge.style.borderColor="rgba(255,209,102,.4)"; }
  else{ icon.textContent="💪"; label.textContent="Just Starting!"; label.style.color="var(--red)"; if(badge) badge.style.borderColor="rgba(255,107,107,.3)"; }
}

// ── LAST ACTIVITY ────────────────────────
function updateLastActivity() {
  const f = new Date().toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  const el = document.getElementById("lastActivity");
  if(el) el.textContent = `Last active: ${f}`;
  localStorage.setItem("lastActivity", f);
}

// Load saved activity on init
window.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("lastActivity");
  const el = document.getElementById("lastActivity");
  if(saved && el) el.textContent = `Last active: ${saved}`;
});