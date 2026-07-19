// ============================================
//  Auth Middleware — Route Protection
// ============================================

// Check if user is logged in
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: "Please login first." });
}

// Check if user is faculty
function isFaculty(req, res, next) {
  if (req.session?.user?.role === "faculty") return next();
  res.status(403).json({ error: "Access denied. Faculty only." });
}

// Check if user is student
function isStudent(req, res, next) {
  if (req.session?.user?.role === "student") return next();
  res.status(403).json({ error: "Access denied. Students only." });
}

module.exports = { isAuthenticated, isFaculty, isStudent };