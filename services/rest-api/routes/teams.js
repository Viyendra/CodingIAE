const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Database tim in-memory (sesuai dengan data di auth.js)
let teams = [
  { id: 't1', name: 'SI4704', members: ['1', '2','3'] }, // '1' dan '2' adalah ID user dari global.users
];

// GET /api/teams - Dapatkan semua tim
router.get('/', (req, res) => {
  // Nanti, endpoint ini akan dilindungi oleh Gateway.
  // Kita bisa filter tim berdasarkan user ID dari token:
  // const userId = req.headers['x-user-id']; 
  
  // Untuk saat ini, tampilkan semua tim
  res.json(teams);
});

// GET /api/teams - Dapatkan semua tim
router.get('/', (req, res) => {
  // Untuk saat ini, tampilkan semua tim
  res.json(teams);
});

// POST /api/teams - Buat tim baru
router.post('/', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Team name is required' });
  }

  const newTeam = {
    id: uuidv4(),
    name,
    members: [],
  };

  teams.push(newTeam);
  res.status(201).json(newTeam);
});

module.exports = router;