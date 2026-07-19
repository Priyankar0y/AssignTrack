const express = require("express");
const router  = express.Router();
const crypto  = require("crypto");
const User    = require("../models/user");
const { isAuthenticated } = require("../middleware/auth");
const { sendPasswordResetEmail } = require("../utils/email");

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, username, email, password, role, section, rollNumber, year, semester, branch, cpi, subject } = req.body;
    if (!name || !username || !email || !password || !role)
      return res.status(400).json({ error: "All fields required." });

    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) return res.status(400).json({ error: "Username or email already taken." });

    const user = new User({ name, username, email, password, role, section, rollNumber, year, semester, branch, cpi: cpi || 0, subject: subject || "" });
    await user.save();
    res.status(201).json({ message: "Registration successful!" });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required." });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: "Invalid username or password." });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ error: "Invalid username or password." });

    req.session.user = { id: user._id, name: user.name, username: user.username, role: user.role, section: user.section, email: user.email, subject: user.subject };
    res.json({ message: "Login successful!", user: req.session.user });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST /auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy();
  res.json({ message: "Logged out." });
});

// GET /auth/me
router.get("/me", isAuthenticated, (req, res) => res.json(req.session.user));

// PUT /auth/profile
router.put("/profile", isAuthenticated, async (req, res) => {
  try {
    const { name, email, section, rollNumber, year, semester, branch, cpi } = req.body;
    const user = await User.findByIdAndUpdate(
      req.session.user.id,
      { name, email, section, rollNumber, year, semester, branch, cpi },
      { new: true }
    );
    req.session.user.name = user.name;
    res.json({ message: "Profile updated!", user });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST /auth/forgot-password — request a reset link
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required." });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    // Always respond the same way, whether or not the email exists —
    // avoids leaking which emails are registered
    if (!user) return res.json({ message: "If that email is registered, a reset link has been sent." });

    const token = crypto.randomBytes(32).toString("hex");
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetUrl = `${req.protocol}://${req.get("host")}/reset-password.html?token=${token}`;
    sendPasswordResetEmail(user, resetUrl); // async — don't await

    res.json({ message: "If that email is registered, a reset link has been sent." });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST /auth/reset-password — set new password using token
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token and new password required." });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });
    if (!user) return res.status(400).json({ error: "Reset link is invalid or has expired." });

    user.password = password; // pre-save hook hashes this
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ message: "Password reset successful! You can now log in." });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;