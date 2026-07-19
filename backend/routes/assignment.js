const express    = require("express");
const router     = express.Router();
const Assignment = require("../models/Assignment");
const User       = require("../models/user"); // matches actual filename (lowercase)
const upload     = require("../middleware/upload");
const { isAuthenticated, isFaculty, isStudent } = require("../middleware/auth");
const { sendNewAssignmentEmail } = require("../utils/email");

// GET /assignments — get all (students see their section's, faculty sees all)
router.get("/", isAuthenticated, async (req, res) => {
  try {
    let assignments;
    if (req.session.user.role === "faculty") {
      assignments = await Assignment.find().sort({ createdAt: -1 });
    } else {
      const section = req.session.user.section;
      assignments = await Assignment.find({
        $or: [{ sections: [] }, { sections: section }]
      }).sort({ createdAt: -1 });
    }
    res.json(assignments);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST /assignments — faculty only upload
router.post("/", isAuthenticated, isFaculty, async (req, res) => {
  try {
    const { title, subject, deadline, priority, notes, sections } = req.body;
    if (!title || !subject || !deadline) return res.status(400).json({ error: "Required fields missing." });

    const sectionArr = sections ? (Array.isArray(sections) ? sections : [sections]) : [];

    const assignment = new Assignment({
      title, subject, deadline: new Date(deadline),
      priority: priority || "medium",
      notes: notes || "",
      sections: sectionArr,
      uploadedBy: req.session.user.id,
      uploadedByName: req.session.user.name
    });

    await assignment.save();

    // Send email notifications to relevant students
    const query = sectionArr.length > 0 ? { role:"student", section:{ $in: sectionArr } } : { role:"student" };
    const students = await User.find(query);
    sendNewAssignmentEmail(students, assignment); // async — don't await

    res.status(201).json(assignment);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// PUT /assignments/:id — faculty edit
router.put("/:id", isAuthenticated, isFaculty, async (req, res) => {
  try {
    const { title, subject, deadline, priority, notes, sections } = req.body;
    const assignment = await Assignment.findByIdAndUpdate(
      req.params.id,
      { title, subject, deadline: new Date(deadline), priority, notes,
        sections: sections ? (Array.isArray(sections) ? sections : [sections]) : [] },
      { new: true }
    );
    if (!assignment) return res.status(404).json({ error: "Not found." });
    res.json(assignment);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// DELETE /assignments/:id — faculty only
router.delete("/:id", isAuthenticated, isFaculty, async (req, res) => {
  try {
    await Assignment.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted." });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST /assignments/:id/submit — student submit PDF
// isStudent runs BEFORE upload.single, so non-students are rejected
// before a file is ever written to disk
router.post("/:id/submit", isAuthenticated, isStudent, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "PDF file required." });

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ error: "Assignment not found." });

    const studentId = req.session.user.id.toString();
    const existingIdx = assignment.submissions.findIndex(s => s.student.toString() === studentId);

    const deadline = new Date(assignment.deadline);
    const now      = new Date();
    const status   = now > deadline ? "late" : "submitted";

    const submissionData = {
      student:     req.session.user.id,
      studentName: req.session.user.name,
      section:     req.session.user.section,
      filePath:    req.file.path,
      fileName:    req.file.originalname,
      submittedAt: now,
      status
    };

    if (existingIdx >= 0) {
      // Update existing submission
      assignment.submissions[existingIdx] = { ...assignment.submissions[existingIdx]._doc, ...submissionData };
    } else {
      assignment.submissions.push(submissionData);
    }

    await assignment.save();
    res.json({ message: `Assignment ${status}!`, status });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// PUT /assignments/:id/grade/:studentId — faculty give grade & remarks
router.put("/:id/grade/:studentId", isAuthenticated, isFaculty, async (req, res) => {
  try {
    const { grade, remarks } = req.body;
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ error: "Assignment not found." });

    const sub = assignment.submissions.find(s => s.student.toString() === req.params.studentId);
    if (!sub) return res.status(404).json({ error: "Submission not found." });

    sub.grade    = grade;
    sub.remarks  = remarks;
    sub.gradedAt = new Date();
    sub.gradedBy = req.session.user.name;

    await assignment.save();
    res.json({ message: "Grade saved!", submission: sub });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /assignments/:id/my-submission — student sees own grade
router.get("/:id/my-submission", isAuthenticated, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ error: "Not found." });

    const sub = assignment.submissions.find(s => s.student.toString() === req.session.user.id.toString());
    res.json(sub || null);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /dashboard/stats
router.get("/dashboard/stats", isAuthenticated, async (req, res) => {
  try {
    let assignments;
    if (req.session.user.role === "faculty") {
      assignments = await Assignment.find();
    } else {
      const section = req.session.user.section;
      assignments = await Assignment.find({ $or: [{ sections:[] }, { sections: section }] });
    }
    const total = assignments.length;
    const studentId = req.session.user.id?.toString();

    let completed = 0;
    if (req.session.user.role === "student") {
      completed = assignments.filter(a => {
        const sub = a.submissions.find(s => s.student.toString() === studentId);
        return sub && (sub.status === "submitted" || sub.status === "late");
      }).length;
    }

    res.json({ total, completed, pending: total - completed });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;