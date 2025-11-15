'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, gql, useSubscription } from '@apollo/client';
import { authApi, userApi } from '@/lib/api'; //

// === Query & Mutation GraphQL (Posts/Comments) ===
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
      id, title, content, author
    }
  }
`;

const DELETE_POST = gql`
  mutation DeletePost($id: ID!) {
    deletePost(id: $id)
  }
`;

// === SUBSCRIPTION GRAPHQL BARU ===
const COMMENT_SUBSCRIPTION = gql`
  subscription CommentPosted {
    commentPosted {
      content
      author
      postId
    }
  }
`;
// ======================================

/**
 * Komponen Utama
 */
export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem('authToken', token);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
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
 * Komponen Autentikasi (Tetap sama)
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


// FUNGSI HELPER: Decode Token
function getDecodedToken(): { name: string, role: string } | null {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        name: payload.name || 'User',
        role: payload.role || 'user'
      };
    } catch (e) {
      return null;
    }
}

/**
 * Komponen Dashboard (Posts/Comments)
 */
function DashboardComponent({ onLogout }: { onLogout: () => void }) {
  const { data: postsData, loading: postsLoading, error: postsError, refetch: refetchPosts } = useQuery(GET_POSTS);
  
  const [createPost] = useMutation(CREATE_POST, { refetchQueries: [GET_POSTS] });
  const [deletePost] = useMutation(DELETE_POST, { refetchQueries: [GET_POSTS] }); 

  const [newPost, setNewPost] = useState({ title: '', content: '' });

  const [userData, setUserData] = useState<{ name: string, role: string } | null>(null);
  // State untuk notifikasi real-time
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    setUserData(getDecodedToken());
    // Auto-clear notification after 5 seconds
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const userName = userData?.name || 'User';
  const userRole = userData?.role || 'user';

  // === SUBSCRIPTION HANDLER BARU (Real-time Updates) ===
  useSubscription(COMMENT_SUBSCRIPTION, {
    onData: ({ data }) => {
      const { commentPosted } = data.data;
      // Hanya tampilkan notifikasi jika komen diposting ke Post ID 2
      if (commentPosted && commentPosted.postId === '2') {
        setNotification(`[REAL-TIME] ${commentPosted.author} baru saja berkomentar di post "Real-time Updates"!`);
        refetchPosts(); // Refresh list posts untuk melihat komen baru
      }
    }
  });
  // ===================================

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
          author: userName,
        },
      });
      setNewPost({ title: '', content: '' });
    } catch (err) {
      console.error('Failed to create post:', err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (window.confirm('Anda yakin ingin menghapus post ini?')) {
      try {
        await deletePost({ variables: { id: postId } });
        refetchPosts();
      } catch (err: any) {
        alert('Gagal menghapus post: ' + err.message);
      }
    }
  };

  if (postsLoading) return <p>Loading dashboard...</p>;
  if (postsError) {
    console.error('GraphQL Error:', postsError.message);
    onLogout();
    return <p>Error loading data. Logging out...</p>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Selamat Datang, {userName}!</h1>
          <p className="text-xl text-gray-600">Peran Anda: <span className="font-bold">{userRole}</span></p>
        </div>
        <button onClick={onLogout} className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600">
          Logout
        </button>
      </div>

      {/* === NOTIFIKASI IN-PAGE BARU === */}
      {notification && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4" role="alert">
          <p className="font-bold">Notifikasi Komentar Baru!</p>
          <p>{notification}</p>
        </div>
      )}
      {/* =================================== */}

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
        {postsData?.posts.map((post: any) => (
          <div key={post.id} className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{post.title}</h2>
            <p className="text-sm text-gray-500 mb-4">by {post.author} on {new Date(post.createdAt).toLocaleDateString('id-ID')}</p>
            <p className="text-gray-700">{post.content}</p>
            
            {/* Tombol Hapus Post (Hanya untuk Admin atau Pemilik) */}
            {(userRole === 'admin' || post.author === userName) && (
              <button 
                onClick={() => handleDeletePost(post.id)}
                className="mt-4 bg-red-100 text-red-700 px-3 py-1 rounded text-sm font-medium hover:bg-red-200"
              >
                Hapus Post
              </button>
            )}
            
            {/* Bagian Komentar */}
            <div className="mt-6 border-t pt-4">
              <h4 className="text-lg font-semibold mb-2">Comments ({post.comments.length})</h4>
              <div className="space-y-2 mb-4">
                {post.comments.map((comment: any) => (
                  <div key={comment.id} className="text-sm bg-gray-50 p-2 rounded">
                    <strong>{comment.author}:</strong> {comment.content}
                  </div>
                ))}
                {post.comments.length === 0 && <p className="text-sm text-gray-500">Belum ada komentar.</p>}
              </div>

              {/* Form Balasan Komentar */}
              <CommentForm 
                postId={post.id} 
                userName={userName} 
                userRole={userRole}
                refetchPosts={refetchPosts} 
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// === KOMPONEN BALAS KOMENTAR ===
function CommentForm({ postId, userName, userRole, refetchPosts }: { postId: string, userName: string, userRole: string, refetchPosts: () => void }) {
  const [commentContent, setCommentContent] = useState('');
  const [createComment] = useMutation(gql`
    mutation CreateComment($postId: ID!, $content: String!, $author: String!) {
        createComment(postId: $postId, content: $content, author: $author) {
            id
        }
    }
  `);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent) return;

    try {
        await createComment({
            variables: {
                postId: postId,
                content: commentContent,
                author: userName,
            }
        });
        setCommentContent('');
        // Kita tidak perlu refetch jika subscription berjalan dengan baik,
        // tapi kita biarkan untuk memastikan data terupdate
        refetchPosts(); 
    } catch (err: any) {
        alert('Gagal posting komentar: ' + err.message);
    }
  };

  // Logika Otorisasi Frontend: Cek apakah user diizinkan berkomentar di Post ID 1
  const isPost1Restricted = postId === '1';
  const isAuthorizedToComment = !isPost1Restricted || userRole === 'admin' || userRole === 'contributor';


  if (isPost1Restricted && !isAuthorizedToComment) {
    return <p className="text-sm text-red-500 mt-3">Hanya Admin atau Contributor yang bisa membalas post ini.</p>;
  }


  return (
    <form onSubmit={handleSubmit} className="mt-3">
        <input 
            type="text" 
            value={commentContent}
            onChange={(e) => setCommentContent(e.target.value)}
            placeholder="Tulis balasan..."
            className="border rounded-md px-3 py-2 w-full text-sm"
            required
        />
        <button 
            type="submit" 
            className="mt-2 bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
        >
            Balas
        </button>
    </form>
  );
}