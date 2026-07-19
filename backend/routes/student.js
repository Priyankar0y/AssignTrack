const express    = require("express");
const router     = express.Router();
const User       = require("../models/user"); // matches actual filename (lowercase)
const Assignment = require("../models/Assignment");
const { isAuthenticated, isFaculty } = require("../middleware/auth");

// GET /students/profile — get own profile (student)
router.get("/profile", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /students/my-profile — student apna profile dekhe
router.get("/my-profile", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /students — faculty sees all students with filters
router.get("/", isAuthenticated, isFaculty, async (req, res) => {
  try {
    const { section, minCpi, maxCpi, year, sortBy } = req.query;
    let query = { role: "student" };
    if (section) query.section = section;
    if (year)    query.year    = year;
    if (minCpi || maxCpi) {
      query.cpi = {};
      if (minCpi) query.cpi.$gte = parseFloat(minCpi);
      if (maxCpi) query.cpi.$lte = parseFloat(maxCpi);
    }
    let sort = {};
    if (sortBy === "cpi_asc")       sort = { cpi: 1 };
    else if (sortBy === "cpi_desc") sort = { cpi: -1 };
    else if (sortBy === "name_asc") sort = { name: 1 };
    else sort = { section: 1, name: 1 };
    const students = await User.find(query).sort(sort).select("-password");
    res.json(students);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /students/sections
router.get("/sections", isAuthenticated, isFaculty, async (req, res) => {
  try {
    const sections = await User.distinct("section", { role:"student", section:{ $ne:"" } });
    res.json(sections.sort());
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /students/tracker
router.get("/tracker", isAuthenticated, isFaculty, async (req, res) => {
  try {
    const { section } = req.query;
    let studentQuery = { role: "student" };
    if (section) studentQuery.section = section;
    const students    = await User.find(studentQuery).select("-password").sort({ section:1, name:1 });
    const assignments = await Assignment.find();
    const tracker = students.map(student => {
      const submissionMap = {};
      assignments.forEach(a => {
        const sub = a.submissions.find(s => s.student.toString() === student._id.toString());
        submissionMap[a._id.toString()] = {
          status:      sub ? sub.status : "pending",
          submittedAt: sub ? sub.submittedAt : null,
          grade:       sub ? sub.grade : null,
          remarks:     sub ? sub.remarks : null,
          fileName:    sub ? sub.fileName : null
        };
      });
      const totalSubmitted = Object.values(submissionMap).filter(s => s.status !== "pending").length;
      return {
        student: { _id:student._id, name:student.name, section:student.section, rollNumber:student.rollNumber, cpi:student.cpi, email:student.email },
        submissions: submissionMap,
        totalSubmitted,
        totalAssignments: assignments.length
      };
    });
    res.json({ tracker, assignments: assignments.map(a => ({ _id:a._id, title:a.title, subject:a.subject, deadline:a.deadline })) });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /students/section-summary
router.get("/section-summary", isAuthenticated, isFaculty, async (req, res) => {
  try {
    const students    = await User.find({ role:"student" }).select("-password");
    const assignments = await Assignment.find();
    const sectionMap  = {};
    students.forEach(student => {
      const sec = student.section || "Unassigned";
      if (!sectionMap[sec]) sectionMap[sec] = { students:[], totalSubmissions:0 };
      let submitted = 0;
      assignments.forEach(a => {
        const sub = a.submissions.find(s => s.student.toString() === student._id.toString());
        if (sub && sub.status !== "pending") submitted++;
      });
      sectionMap[sec].students.push({
        _id: student._id, name: student.name, rollNumber: student.rollNumber,
        cpi: student.cpi, email: student.email, submitted,
        total: assignments.length,
        percentage: assignments.length ? Math.round((submitted/assignments.length)*100) : 0
      });
      sectionMap[sec].totalSubmissions += submitted;
    });
    res.json(sectionMap);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;