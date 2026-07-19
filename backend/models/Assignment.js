// ============================================
//  Assignment Model — Created by Faculty
// ============================================
const mongoose = require("mongoose");

// Submission sub-schema (per student)
const submissionSchema = new mongoose.Schema({
  student:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  studentName: { type: String },
  section:     { type: String },
  rollNumber:  { type: String },
  filePath:    { type: String, default: null },   // PDF file path
  fileName:    { type: String, default: null },
  submittedAt: { type: Date, default: null },
  status:      { type: String, enum: ["pending", "submitted", "late"], default: "pending" },
  // Teacher feedback
  grade:       { type: String, default: null },   // e.g. "A", "B+", "85/100"
  remarks:     { type: String, default: null },
  gradedAt:    { type: Date, default: null },
  gradedBy:    { type: String, default: null }
});

const assignmentSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  subject:     { type: String, required: true, trim: true },
  deadline:    { type: Date, required: true },
  priority:    { type: String, enum: ["high", "medium", "low"], default: "medium" },
  notes:       { type: String, default: "" },
  // Target sections — empty means all sections
  sections:    [{ type: String }],
  uploadedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  uploadedByName: { type: String },
  submissions: [submissionSchema],
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model("Assignment", assignmentSchema);