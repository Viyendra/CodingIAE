const express = require('express');
const { v4: uuidv4 } = require('uuid'); // Kita masih butuh ini untuk ID baru jika ada
const { validateUser, validateUserUpdate } = require('../middleware/validation');

const router = express.Router();

// HAPUS: 'let users = [...]'
// Database 'users' sekarang dikelola di 'auth.js' sebagai 'global.users'

// GET /api/users - Get all users
router.get('/', (req, res) => {
  const { page, limit, role, search } = req.query;
  
  // Pastikan global.users ada
  let filteredUsers = global.users ? [...global.users] : [];
  
  // Filter by role
  if (role) {
    filteredUsers = filteredUsers.filter(user => user.role === role);
  }
  
  // Search by name or email
  if (search) {
    filteredUsers = filteredUsers.filter(user => 
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  // Fungsi untuk menghapus passwordHash dari user object
  const stripPassword = (user) => {
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  };

  // Terapkan penghapusan password ke semua user yang akan dikirim
  filteredUsers = filteredUsers.map(stripPassword);

  // Pagination logic (tetap sama)
  if (page && limit) {
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
    
    return res.json({
      users: paginatedUsers,
      pagination: { /* ... */ }
    });
  }
  
  res.json(filteredUsers);
});

// GET /api/users/:id - Get user by ID
router.get('/:id', (req, res) => {
  if (!global.users) {
    return res.status(500).json({ error: 'User data not initialized' });
  }
  
  const user = global.users.find(u => u.id === req.params.id);
  
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: `User with ID ${req.params.id} does not exist`
    });
  }
  
  // Hapus passwordHash sebelum mengirim
  const { passwordHash, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

// POST /api/users - HAPUS
// Endpoint ini (membuat user) sudah dipindahkan ke POST /api/auth/register
// Kita HAPUS rute 'router.post('/', ...)' dari file ini.

// PUT /api/users/:id - Update user
router.put('/:id', validateUserUpdate, (req, res) => {
  if (!global.users) {
    return res.status(500).json({ error: 'User data not initialized' });
  }

  const userIndex = global.users.findIndex(u => u.id === req.params.id);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const { name, email, age, role } = req.body;
  
  // Cek duplikat email (jika email diubah)
  if (email) {
    const existingUser = global.users.find(u => u.email === email && u.id !== req.params.id);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already exists' });
    }
  }
  
  const updatedUser = {
    ...global.users[userIndex],
    ...(name && { name }),
    ...(email && { email }),
    ...(age && { age }),
    ...(role && { role }),
    updatedAt: new Date().toISOString()
  };
  
  global.users[userIndex] = updatedUser;
  
  // Hapus passwordHash sebelum mengirim
  const { passwordHash, ...userWithoutPassword } = updatedUser;
  res.json({
    message: 'User updated successfully',
    user: userWithoutPassword
  });
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', (req, res) => {
  if (!global.users) {
    return res.status(500).json({ error: 'User data not initialized' });
  }

  const userIndex = global.users.findIndex(u => u.id === req.params.id);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const deletedUser = global.users.splice(userIndex, 1)[0];
  
  // Hapus passwordHash sebelum mengirim
  const { passwordHash, ...userWithoutPassword } = deletedUser;
  res.json({
    message: 'User deleted successfully',
    user: userWithoutPassword
  });
});

module.exports = router;