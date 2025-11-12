// Middleware untuk memeriksa apakah user adalah admin
const isAdmin = (req, res, next) => {
  // 'x-user-role' akan disuntikkan oleh API Gateway
  const role = req.headers['x-user-role']; 

  if (role === 'admin') {
    next(); // Lanjutkan, Anda admin
  } else {
    // Ditolak!
    res.status(403).json({ error: 'Forbidden: Access is denied. Admin role required.' });
  }
};

module.exports = { isAdmin };