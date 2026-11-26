const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

// Tokens expire after a few hours (risk table: limits damage from a stolen token).
const TOKEN_TTL = process.env.TOKEN_TTL || '8h';

function signToken(user) {
  return jwt.sign(
    { id: user.user_id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

// requireRole() with no roles = any logged-in user.
// requireRole('technician', 'admin') = only those roles.
function requireRole(...roles) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Please log in' });
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    next();
  };
}

const requireAuth = requireRole();

module.exports = { requireRole, requireAuth, signToken, JWT_SECRET };
