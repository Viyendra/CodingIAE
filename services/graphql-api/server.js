const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { PubSub } = require('graphql-subscriptions');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

// (Impor baru untuk perbaikan Subscription)
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');
const { makeExecutableSchema } = require('@graphql-tools/schema');

const app = express();
const pubsub = new PubSub();

// Enable CORS (konfigurasi lama Anda)
app.use(cors({
  origin: [
    'http://localhost:3000', // API Gateway
    'http://localhost:3002', // Frontend
    'http://api-gateway:3000', // Docker container name
    'http://frontend-app:3002' // Docker container name
  ],
  credentials: true
}));

// === Database In-Memory ASLI (Posts/Comments) ===
let posts = [
  {
    id: '1',
    title: 'Welcome to GraphQL',
    content: 'This is our first GraphQL post with subscriptions!',
    author: 'GraphQL Team',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Real-time Updates',
    content: 'Watch this space for real-time updates using GraphQL subscriptions.',
    author: 'Development Team',
    createdAt: new Date().toISOString(),
  }
];

let comments = [
  {
    id: '1',
    postId: '1',
    content: 'Great introduction to GraphQL!',
    author: 'viyen admin',
    createdAt: new Date().toISOString(),
  }
];
// ===============================================

// === Skema GraphQL ASLI (Type Definitions) ===
const typeDefs = `
  type Post {
    id: ID!
    title: String!
    content: String!
    author: String!
    createdAt: String!
    comments: [Comment!]!
  }

  type Comment {
    id: ID!
    postId: ID!
    content: String!
    author: String!
    createdAt: String!
  }

  type Query {
    posts: [Post!]!
    post(id: ID!): Post
    comments(postId: ID!): [Comment!]!
  }

  type Mutation {
    createPost(title: String!, content: String!, author: String!): Post!
    updatePost(id: ID!, title: String, content: String): Post!
    deletePost(id: ID!): Boolean!
    createComment(postId: ID!, content: String!, author: String!): Comment!
    deleteComment(id: ID!): Boolean!
  }

  type Subscription {
    postAdded: Post!
    commentAdded: Comment!
    postUpdated: Post!
    postDeleted: ID!
    commentPosted: Comment!
  }
`;

// === Resolvers ASLI (dengan integrasi 'context') ===
const resolvers = {
  Query: {
    posts: () => posts,
    post: (_, { id }) => posts.find(post => post.id === id),
    comments: (_, { postId }) => comments.filter(comment => comment.postId === postId),
  },

  Post: {
    comments: (parent) => comments.filter(comment => comment.postId === parent.id),
  },

  Mutation: {
    createPost: (_, { title, content, author }, context) => {
      // Integrasi Keamanan: Gunakan nama user dari token
      const postAuthor = context.userName || author; // Prioritaskan nama dari token
      console.log(`User ${postAuthor} (ID: ${context.userId}) sedang membuat post.`);

      const newPost = {
        id: uuidv4(),
        title,
        content,
        author: postAuthor,
        createdAt: new Date().toISOString(),
      };
      posts.push(newPost);
      
      pubsub.publish('POST_ADDED', { postAdded: newPost });
      
      return newPost;
    },

    updatePost: (_, { id, title, content }) => {
      const postIndex = posts.findIndex(post => post.id === id);
      if (postIndex === -1) {
        throw new Error('Post not found');
      }
      const updatedPost = {
        ...posts[postIndex],
        ...(title && { title }),
        ...(content && { content }),
      };
      posts[postIndex] = updatedPost;
      pubsub.publish('POST_UPDATED', { postUpdated: updatedPost });
      return updatedPost;
    },

    deletePost: (_, { id }, context) => {
      const postIndex = posts.findIndex(post => post.id === id);
      if (postIndex === -1) {
        return false;
      }
      // === LOGIKA HAK AKSES BARU ===
      const post = posts[postIndex];
      
      // Cek apakah user adalah 'admin' ATAU nama author post sama dengan nama user di token
      if (context.userRole === 'admin' || post.author === context.userName) {
        
        // Oke, diizinkan menghapus
        comments = comments.filter(comment => comment.postId !== id);
        posts.splice(postIndex, 1);
        pubsub.publish('POST_DELETED', { postDeleted: id });
        return true;
        
      } else {
        // Ditolak!
        console.warn(`User ${context.userName} (Role: ${context.userRole}) mencoba menghapus post milik ${post.author} tanpa izin!`);
        throw new Error('You are not authorized to delete this post.');
      }
    },

    createComment: (_, { postId, content, author }, context) => {
      const commentAuthor = context.userName || author;

      const post = posts.find(p => p.id === postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // === LOGIKA OTORISASI KOMENTAR BARU ===
      // Post ID 1 (Welcome to GraphQL) hanya untuk admin/contributor
      const allowedRoles = ['admin', 'contributor'];
      if (postId === '1' && !allowedRoles.includes(context.userRole)) {
        console.warn(`User ${context.userName} (Role: ${context.userRole}) DITOLAK berkomentar pada Post ID 1.`);
        throw new Error('Anda tidak diizinkan berkomentar pada post ini. Role Admin atau Contributor diperlukan.');
      }
      // ======================================

      const newComment = {
        id: uuidv4(),
        postId,
        content,
        author: commentAuthor,
        createdAt: new Date().toISOString(),
      };
      comments.push(newComment);
      
      pubsub.publish('COMMENT_ADDED', { commentAdded: newComment });
      
      // === LOGIKA NOTIFIKASI REAL-TIME BARU ===
      if (postId === '2') { // Hanya Post ID 2 (Real-time Updates) yang memicu notifikasi
        pubsub.publish(POST_COMMENTED, { commentPosted: newComment });
      }
      // =======================================
      
      return newComment;
    },

    deleteComment: (_, { id }) => {
      const commentIndex = comments.findIndex(comment => comment.id === id);
      if (commentIndex === -1) {
        return false;
      }
      comments.splice(commentIndex, 1);
      return true;
    },
  },

  Subscription: {
    postAdded: {
      subscribe: () => pubsub.asyncIterator(['POST_ADDED']),
    },
    commentAdded: {
      subscribe: () => pubsub.asyncIterator(['COMMENT_ADDED']),
    },
    postUpdated: {
      subscribe: () => pubsub.asyncIterator(['POST_UPDATED']),
    },
    postDeleted: {
      subscribe: () => pubsub.asyncIterator(['POST_DELETED']),
    },
    commentPosted: {
        subscribe: () => pubsub.asyncIterator([POST_COMMENTED]),
    },
  },
};

// Buat skema yang bisa dieksekusi
const schema = makeExecutableSchema({ typeDefs, resolvers });

async function startServer() {
  // Create Apollo Server
  const server = new ApolloServer({
    schema, // Gunakan schema
    context: ({ req }) => {
      // === INTEGRASI KEAMANAN (Tetap dipertahankan) ===
      // === INTEGRASI KEAMANAN (Perbaikan Pembacaan Role Header) ===
      const userId = req.headers['x-user-id'] || '';
      const userName = req.headers['x-user-name'] || 'Guest';
      const userEmail = req.headers['x-user-email'] || '';
      
      // Ambil nilai mentah header 'x-user-role'
      const userRoleRaw = req.headers['x-user-role'];

      // Logika yang lebih aman: 
      // 1. Cek apakah itu array (jika header terduplikasi), ambil elemen pertama.
      // 2. Jika bukan, ambil nilai mentah.
      // 3. Ubah ke huruf kecil dan default ke 'user' jika tetap kosong.
      const userRole = (Array.isArray(userRoleRaw) ? userRoleRaw[0] : userRoleRaw)?.toLowerCase() || 'user';
      
      const userTeams = (req.headers['x-user-teams'] || '').split(',');

      // Kirim pesan debug ke log Docker untuk verifikasi
      console.log(`[AUTH-GQL] User: ${userName}, Role: ${userRole}`); 

      return { userId, userName, userEmail, userTeams, userRole, req };},
    plugins: [
      {
        requestDidStart() {
          return {
            willSendResponse(requestContext) {
              console.log(`GraphQL ${requestContext.request.operationName || 'Anonymous'} operation completed`);
            },
          };
        },
      },
    ],
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  const PORT = process.env.PORT || 4000;
  
  // === PERBAIKAN SUBSCRIPTION (Tetap dipertahankan) ===
  const httpServer = createServer(app);
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: server.graphqlPath,
  });
  useServer({ schema }, wsServer);
  httpServer.listen(PORT, () => {
    console.log(`🚀 Post/Comment Service (GraphQL) running on port ${PORT}`);
    console.log(`GraphQL endpoint: http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`Subscriptions ready at ws://localhost:${PORT}${server.graphqlPath}`);
  });
}

// Health check endpoint (Update nama service)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'post-comment-graphql-api',
    timestamp: new Date().toISOString(),
    data: {
      posts: posts.length,
      comments: comments.length
    }
  });
});

// ... (Error handling) ...
app.use((err, req, res, next) => {
  console.error('GraphQL API Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

startServer().catch(error => {
  console.error('Failed to start GraphQL server:', error);
  process.exit(1);
});