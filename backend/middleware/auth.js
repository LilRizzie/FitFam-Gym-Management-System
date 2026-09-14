const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Bearer token is required' });
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const [rows] = await pool.execute('SELECT id, role, is_active FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length || !rows[0].is_active) return res.status(401).json({ success: false, message: 'Account is inactive or no longer exists' });
    req.user.role = rows[0].role;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission for this action' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
