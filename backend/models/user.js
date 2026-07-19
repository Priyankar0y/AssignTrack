// ============================================
//  User Model — Students & Faculty
// ============================================
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, trim: true },
  email:    { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ["faculty", "student"], required: true },

  section:    { type: String, default: "" },
  rollNumber: { type: String, default: "" },
  year:       { type: String, default: "" },
  semester:   { type: String, default: "" },
  branch:     { type: String, default: "" },
  cpi:        { type: Number, default: 0, min: 0, max: 10 },
  subject:    { type: String, default: "" },

  // Password reset
  resetToken:       { type: String, default: null },
  resetTokenExpiry: { type: Date,   default: null },

  createdAt: { type: Date, default: Date.now }
});

userSchema.pre("save", async function() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function(plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model("User", userSchema);