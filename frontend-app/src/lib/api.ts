import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// === INTERCEPTOR BARU ===
// Ini akan 'mencegat' setiap request SEBELUM dikirim
apiClient.interceptors.request.use(
  (config) => {
    // Ambil token dari local storage
    // (Kita asumsikan token disimpan di sini setelah login)
    const token = localStorage.getItem('authToken');
    
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
// =========================

// --- API Service BARU untuk Autentikasi ---
export const authApi = {
  // Tipe data 'any' untuk password agar simpel
  login: (data: { email: string; password: any }) => 
    apiClient.post('/api/auth/login', data),
  
  register: (data: { name: string; email: string; age: number; password: any }) => 
    apiClient.post('/api/auth/register', data),
};
// ===========================================

// User API calls (ini masih bisa dipakai, dan sekarang otomatis ter-autentikasi!)
export const userApi = {
  getUsers: () => apiClient.get('/api/users'),
  getUser: (id: string) => apiClient.get(`/api/users/${id}`),
  // Hapus createUser, karena sudah diganti 'register'
  updateUser: (id: string, userData: { name?: string; email?: string; age?: number }) => 
    apiClient.put(`/api/users/${id}`, userData),
  deleteUser: (id: string) => apiClient.delete(`/api/users/${id}`),
};