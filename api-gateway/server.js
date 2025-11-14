const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken'); // BARU
const axios = require('axios'); // BARU
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// URL service dari environment variables (didefinisikan di docker-compose.dev.yml)
const USER_SERVICE_URL = process.env.REST_API_URL || 'http://rest-api:3001';
const TASK_SERVICE_URL = process.env.GRAPHQL_API_URL || 'http://graphql-api:4000';

// Variabel untuk menyimpan public key
let PUBLIC_KEY = null;

/**
 * Fungsi untuk mengambil public key dari User Service.
 * Akan terus mencoba setiap 5 detik jika gagal.
 */
async function fetchPublicKey() {
  try {
    // Memanggil endpoint /api/auth/public-key yang kita buat di Bagian 1
    const response = await axios.get(`${USER_SERVICE_URL}/api/auth/public-key`);
    PUBLIC_KEY = response.data;
    console.log('✅ Public Key berhasil diambil dari User Service.');
  } catch (error) {
    console.error('❌ Gagal mengambil Public Key:', error.message);
    console.log('Mencoba lagi dalam 5 detik...');
    setTimeout(fetchPublicKey, 5000); // Coba lagi
  }
}

// Security middleware (sama seperti sebelumnya)
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3002', // Frontend
    'http://frontend-app:3002' // Docker container name
  ],
  credentials: true
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// Health check endpoint (tidak perlu auth)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});


// === MIDDLEWARE AUTHENTICATION (SATPAM) ===
// Ini akan berjalan untuk SEMUA request setelah /health
app.use(async (req, res, next) => {
  
  // Daftar rute-rute publik yang TIDAK memerlukan token
  const publicRoutes = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/public-key' // (Walaupun tidak akan diakses dari luar)
  ];

  if (publicRoutes.includes(req.path)) {
    return next(); // Lewati cek, langsung ke proxy
  }

  // Jika service belum siap (belum dapat public key)
  if (!PUBLIC_KEY) {
    return res.status(503).json({ error: 'Service unavailable. Auth service is not ready.' });
  }

  // Ambil token dari header 'Authorization'
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"

  if (token == null) {
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }

  // Verifikasi token menggunakan Public Key
  jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] }, (err, decoded) => {
    if (err) {
      console.error('JWT Verify Error:', err.message);
      return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    }

    // Token valid!
    // Suntikkan data user dari token ke dalam header request
    // Sehingga service di belakang (Task Service) bisa membacanya
    req.headers['x-user-id'] = decoded.userId;
    req.headers['x-user-name'] = decoded.name;
    req.headers['x-user-email'] = decoded.email;
    req.headers['x-user-role'] = decoded.role;
    req.headers['x-user-teams'] = (decoded.teams || []).join(','); // Kirim ID tim

    next(); // Lanjutkan request ke proxy
  });
});
// ==========================================


// Proxy configuration for REST API (User Service)
const restApiProxy = createProxyMiddleware({
  target: USER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api', // Pastikan /api tetap ada
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Gateway] -> REST: ${req.method} ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('REST API Proxy Error:', err.message);
    res.status(502).json({ error: 'REST API service unavailable' });
  }
});

// Proxy configuration for GraphQL API (Task Service)
const graphqlApiProxy = createProxyMiddleware({
  target: TASK_SERVICE_URL,
  changeOrigin: true,
  ws: true, // PENTING: Untuk WebSocket (Subscriptions)
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Gateway] -> GQL: ${req.method} ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('GraphQL API Proxy Error:', err.message);
    res.status(502).json({ error: 'GraphQL API service unavailable' });
  }
});

// Terapkan proxies
app.use('/api', restApiProxy); // Semua request ke /api -> User Service
app.use('/graphql', graphqlApiProxy); // Semua request ke /graphql -> Task Service

// ... (Error handling dan 404 handler tetap sama) ...
app.use((err, req, res, next) => {
  console.error('Gateway Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Mulai server dan ambil public key
const server = app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`Proxying /api/* to: ${USER_SERVICE_URL}`);
  console.log(`Proxying /graphql to: ${TASK_SERVICE_URL}`);
  
  // Ambil public key saat startup
  fetchPublicKey();
});