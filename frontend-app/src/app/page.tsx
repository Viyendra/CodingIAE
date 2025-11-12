'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { authApi, userApi } from '@/lib/api'; //
// client tidak perlu diimpor lagi jika tidak dipakai untuk resetStore

// === Query & Mutation GraphQL ASLI (Posts/Comments) ===
// (Berdasarkan skema di services/graphql-api/server.js)

const GET_POSTS = gql`
  query GetPosts {
    posts {
      id
      title
      content
      author
      createdAt
      comments {
        id
        content
        author
      }
    }
  }
`;

const CREATE_POST = gql`
  mutation CreatePost($title: String!, $content: String!, $author: String!) {
    createPost(title: $title, content: $content, author: $author) {
      id
      title
      content
      author
    }
  }
`;
// ======================================

/**
 * Komponen Utama
 */
export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Cek token di localStorage saat aplikasi pertama kali dimuat
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      setAuthToken(token);
      setIsLoggedIn(true);
    }
  }, []);

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem('authToken', token);
    setAuthToken(token);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setAuthToken(null);
    setIsLoggedIn(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      {!isLoggedIn ? (
        <AuthComponent onLoginSuccess={handleLoginSuccess} />
      ) : (
        <DashboardComponent onLogout={handleLogout} />
      )}
    </div>
  );
}

/**
 * Komponen untuk Autentikasi (Login & Register)
 * (Tidak ada perubahan, sama seperti sebelumnya)
 */
function AuthComponent({ onLoginSuccess }: { onLoginSuccess: (token: string) => void }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', age: 18 });
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const response = await authApi.login({
        email: formData.email,
        password: formData.password,
      });
      onLoginSuccess(response.data.token);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await authApi.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        age: Number(formData.age),
      });
      setIsRegistering(false);
      setError('Registration successful! Please log in.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded shadow">
      <h2 className="text-2xl font-bold text-center mb-6">
        {isRegistering ? 'Register' : 'Login'}
      </h2>
      {error && <p className="text-red-500 text-center mb-4">{error}</p>}
      
      <form onSubmit={isRegistering ? handleRegister : handleLogin}>
        {isRegistering && (
          <>
            <input type="text" name="name" placeholder="Name" onChange={handleChange} className="border rounded-md px-3 py-2 w-full mb-4" required />
            <input type="number" name="age" placeholder="Age" onChange={handleChange} className="border rounded-md px-3 py-2 w-full mb-4" required />
          </>
        )}
        <input type="email" name="email" placeholder="Email" onChange={handleChange} className="border rounded-md px-3 py-2 w-full mb-4" required />
        <input type="password" name="password" placeholder="Password" onChange={handleChange} className="border rounded-md px-3 py-2 w-full mb-4" required />
        
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md w-full hover:bg-blue-600">
          {isRegistering ? 'Register' : 'Login'}
        </button>
      </form>

      <button onClick={() => setIsRegistering(!isRegistering)} className="text-sm text-center w-full mt-4 text-blue-500">
        {isRegistering ? 'Already have an account? Login' : "Don't have an account? Register"}
      </button>
    </div>
  );
}


/**
 * Komponen Dashboard (Posts/Comments)
 */
function DashboardComponent({ onLogout }: { onLogout: () => void }) {
  // Gunakan Query GET_POSTS
  const { data, loading, error, refetch } = useQuery(GET_POSTS);
  
  // Gunakan Mutation CREATE_POST
  const [createPost] = useMutation(CREATE_POST, {
    refetchQueries: [GET_POSTS], // Refresh daftar post setelah membuat post baru
  });

  const [newPost, setNewPost] = useState({ title: '', content: '' });

  // Fungsi helper untuk decode token dan ambil nama (opsional, seperti sebelumnya)
  function getUserName(): string | null {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.name || 'User';
    } catch (e) {
      return 'User';
    }
  }
  const userName = getUserName() || 'User';

  const handlePostChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNewPost({ ...newPost, [e.target.name]: e.target.value });
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.title || !newPost.content) {
      alert('Please enter a title and content.');
      return;
    }
    try {
      await createPost({
        variables: {
          title: newPost.title,
          content: newPost.content,
          author: userName, // Otomatis pakai nama user yang login
        },
      });
      setNewPost({ title: '', content: '' }); // Reset form
    } catch (err) {
      console.error('Failed to create post:', err);
    }
  };

  if (loading) return <p>Loading dashboard...</p>;
  if (error) {
    console.error('GraphQL Error:', error.message);
    onLogout();
    return <p>Error loading data. Logging out...</p>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-gray-900">
          Selamat Datang, {userName}!
        </h1>
        <button onClick={onLogout} className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600">
          Logout
        </button>
      </div>

      {/* Form Create Post */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">Create New Post</h2>
        <form onSubmit={handleCreatePost}>
          <div className="grid grid-cols-1 gap-4">
            <input type="text" name="title" placeholder="Post Title" value={newPost.title} onChange={handlePostChange} className="border rounded-md px-3 py-2" required />
            <textarea name="content" placeholder="What's on your mind?" value={newPost.content} onChange={handlePostChange} className="border rounded-md px-3 py-2 h-24" required />
            <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600">
              Submit Post
            </button>
          </div>
        </form>
      </div>

      {/* Daftar Posts */}
      <div className="space-y-8">
        {data?.posts.map((post: any) => (
          <div key={post.id} className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{post.title}</h2>
            <p className="text-sm text-gray-500 mb-4">by {post.author} on {new Date(post.createdAt).toLocaleDateString()}</p>
            <p className="text-gray-700">{post.content}</p>
            
            {/* Bagian Komentar (Sederhana) */}
            <div className="mt-6 border-t pt-4">
              <h4 className="text-lg font-semibold mb-2">Comments ({post.comments.length})</h4>
              <div className="space-y-2">
                {post.comments.map((comment: any) => (
                  <div key={comment.id} className="text-sm bg-gray-50 p-2 rounded">
                    <strong>{comment.author}:</strong> {comment.content}
                  </div>
                ))}
                {post.comments.length === 0 && <p className="text-sm text-gray-500">No comments yet.</p>}
              </div>
              {/* (Anda bisa menambahkan form 'createComment' di sini) */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}