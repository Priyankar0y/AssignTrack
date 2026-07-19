// ============================================
//  AssignTrack v2.0 — Main Server
//  MongoDB + Bcrypt + Sessions + Email + Cron
// ============================================

require("dotenv").config();
const express      = require("express");
const mongoose     = require("mongoose");
const session      = require("express-session");
const MongoStore   = require("connect-mongo").default;
const cron         = require("node-cron");
const path         = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Routes ──────────────────────────────────
const authRoutes        = require("./routes/auth");
const assignmentRoutes  = require("./routes/assignment");
const studentRoutes     = require("./routes/student");

// ── Email utils ─────────────────────────────
const { sendDeadlineReminderEmail } = require("./utils/email");
const User       = require("./models/user"); // lowercase — matches actual filename
const Assignment = require("./models/Assignment");

// ── Connect MongoDB ──────────────────────────
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/assigntrack")
  .then(() => console.log("✅ MongoDB connected!"))
  .catch(err => console.error("❌ MongoDB error:", err));

// ── Middleware ───────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || "assigntrack-secret-2025",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI || "mongodb://localhost:27017/assigntrack"
  }),
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// ── API Routes PEHLE ───────────────────────
app.use("/auth",        authRoutes);
app.use("/assignments", assignmentRoutes);
app.use("/students",    studentRoutes);

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Frontend static — API routes ke BAAD
app.use(express.static(path.join(__dirname, "../frontend")));

// ── Cron: Daily digest at 8 AM ───────────────
cron.schedule("0 8 * * *", async () => {
  console.log("📧 Sending daily digest emails...");
  try {
    const students    = await User.find({ role: "student" });
    const assignments = await Assignment.find({ deadline: { $gte: new Date() } });

    for (const student of students) {
      const pending = assignments.filter(a => {
        const sec = a.sections;
        const inSection = sec.length === 0 || sec.includes(student.section);
        if (!inSection) return false;
        const sub = a.submissions.find(s => s.student.toString() === student._id.toString());
        return !sub || sub.status === "pending";
      });

      if (pending.length > 0) {
        await sendDeadlineReminderEmail(student, pending);
      }
    }
    console.log("✅ Daily digest sent!");
  } catch(err) { console.error("Cron error:", err.message); }
});

// ── 404 + Error handling ─────────────────────
app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Server error" });
});

// ── Start Server ─────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ AssignTrack server running at http://localhost:${PORT}`);
  console.log(`📧 Email: ${process.env.EMAIL_USER || "Not configured"}`);
});