const express    = require("express");
const router     = express.Router();
const User       = require("../models/User");
const Assignment = require("../models/Assignment");
const { isAuthenticated, isFaculty } = require("../middleware/auth");

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
    if (sortBy === "cpi_asc")      sort = { cpi: 1 };
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

// GET /students/my-profile — student apna profile dekhe
router.get("/my-profile", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /students/:id/details — Teacher clicks on student — full details + subject-wise submissions
router.get("/:id/details", isAuthenticated, isFaculty, async (req, res) => {
  try {
    const student = await User.findById(req.params.id).select("-password");
    if (!student) return res.status(404).json({ error: "Student not found." });

    // Get teacher's subject (from session)
    const teacherSubject = req.session.user.subject || null;

    // Get all assignments
    const assignments = await Assignment.find();

    // Filter by teacher's subject if set
    const relevantAssignments = teacherSubject
      ? assignments.filter(a => a.subject.toLowerCase() === teacherSubject.toLowerCase())
      : assignments;

    // Build submission details for each assignment
    const submissionDetails = relevantAssignments.map(a => {
      const sub = a.submissions.find(s => s.student.toString() === student._id.toString());
      return {
        assignmentId:    a._id,
        assignmentTitle: a.title,
        subject:         a.subject,
        deadline:        a.deadline,
        priority:        a.priority,
        status:          sub ? sub.status    : "pending",
        submittedAt:     sub ? sub.submittedAt : null,
        fileName:        sub ? sub.fileName   : null,
        grade:           sub ? sub.grade      : null,
        remarks:         sub ? sub.remarks    : null,
      };
    });

    const totalAssignments = relevantAssignments.length;
    const submitted = submissionDetails.filter(s => s.status !== "pending").length;
    const pending   = totalAssignments - submitted;

    res.json({
      student,
      submissionDetails,
      stats: {
        total:     totalAssignments,
        submitted,
        pending,
        percentage: totalAssignments ? Math.round((submitted/totalAssignments)*100) : 0
      },
      teacherSubject
    });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /students/tracker
router.get("/tracker", isAuthenticated, isFaculty, async (req, res) => {
  try {
    const { section } = req.query;
    let studentQuery  = { role: "student" };
    if (section) studentQuery.section = section;

    const students    = await User.find(studentQuery).select("-password").sort({ section:1, name:1 });
    const assignments = await Assignment.find();

    const tracker = students.map(student => {
      const submissionMap = {};
      assignments.forEach(a => {
        const sub = a.submissions.find(s => s.student.toString() === student._id.toString());
        submissionMap[a._id.toString()] = {
          status:      sub ? sub.status      : "pending",
          submittedAt: sub ? sub.submittedAt : null,
          grade:       sub ? sub.grade       : null,
          remarks:     sub ? sub.remarks     : null,
          fileName:    sub ? sub.fileName    : null
        };
      });
      const totalSubmitted = Object.values(submissionMap).filter(s => s.status !== "pending").length;
      return {
        student: {
          _id: student._id, name: student.name, section: student.section,
          rollNumber: student.rollNumber, cpi: student.cpi, email: student.email
        },
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
        cpi: student.cpi, email: student.email,
        submitted, total: assignments.length,
        percentage: assignments.length ? Math.round((submitted/assignments.length)*100) : 0
      });
      sectionMap[sec].totalSubmissions += submitted;
    });
    res.json(sectionMap);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;