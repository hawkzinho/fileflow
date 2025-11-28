const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);

// Socket.io com CORS corrigido
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Conectar ao MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fileflow';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Conectado ao MongoDB com sucesso!');
})
.catch((err) => {
  console.error('❌ Erro ao conectar no MongoDB:', err.message);
  console.log('💡 Dica: Configure a variável MONGODB_URI no Render.com');
  console.log('🔧 Continuando em modo simples...');
});

// Schemas básicos do MongoDB
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  profile: {
    displayName: String,
    avatar: String,
    bio: { type: String, maxlength: 150 },
    status: {
      type: String,
      enum: ['online', 'offline', 'away', 'busy'],
      default: 'online'
    },
    lastSeen: { type: Date, default: Date.now }
  }
}, {
  timestamps: true
});

// Hash password antes de salvar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Comparar password
userSchema.methods.correctPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Configurar upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './storage';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024
  }
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'seu_secret_super_seguro_aqui_mude_em_producao';

// Middleware de autenticação
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido.' });
  }
};

// Rotas de Autenticação

// Registrar usuário
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Verificar se MongoDB está conectado
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: 'Banco de dados não disponível. Tente novamente em alguns instantes.' 
      });
    }

    // Verificar se usuário já existe
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: 'Usuário ou email já existe' 
      });
    }

    // Criar usuário
    const user = new User({
      username,
      email,
      password,
      profile: {
        displayName: username
      }
    });

    await user.save();

    // Gerar token JWT
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      message: 'Usuário criado com sucesso!',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile
      }
    });

  } catch (error) {
    console.error('Erro no registro:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Usuário ou email já existe' });
    }
    
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Login usuário
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Verificar se MongoDB está conectado
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: 'Banco de dados não disponível. Tente novamente em alguns instantes.' 
      });
    }

    // Encontrar usuário
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Email ou senha incorretos' });
    }

    // Verificar senha
    const isPasswordCorrect = await user.correctPassword(password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ error: 'Email ou senha incorretos' });
    }

    // Atualizar status para online
    user.profile.status = 'online';
    user.profile.lastSeen = new Date();
    await user.save();

    // Gerar token
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      message: 'Login realizado com sucesso!',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Verificar token (usar no frontend para manter login)
app.get('/api/verify', auth, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      profile: req.user.profile
    }
  });
});

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Rota de upload (mantida para compatibilidade)
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const fileInfo = {
      id: Date.now().toString(),
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      uploadDate: new Date(),
      downloadUrl: `/download/${req.file.filename}`
    };

    console.log('✅ Arquivo salvo:', fileInfo.originalName);
    res.json(fileInfo);
  } catch (error) {
    console.error('❌ Erro no upload:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota de download
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'storage', filename);
  
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Arquivo não encontrado' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Socket.io para chat em tempo real
io.on('connection', (socket) => {
  console.log('👤 Usuário conectado:', socket.id);

  socket.on('join-room', (roomId, username) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    socket.to(roomId).emit('user-joined', username);
    console.log(`🚪 ${username} entrou na sala ${roomId}`);
  });

  socket.on('send-message', (data) => {
    console.log('💬 Mensagem recebida:', data);
    io.to(data.roomId).emit('new-message', {
      username: data.username,
      message: data.message,
      timestamp: new Date()
    });
  });

  socket.on('share-file', (fileData) => {
    io.to(fileData.roomId).emit('new-file', fileData);
  });

  socket.on('disconnect', () => {
    console.log('👤 Usuário desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 FileFlow rodando na porta ${PORT}`);
  console.log(`📧 Acesse: http://localhost:${PORT}`);
  console.log(`🗄️  MongoDB: ${MONGODB_URI}`);
  console.log(`🔧 Status MongoDB: ${mongoose.connection.readyState === 1 ? 'CONECTADO' : 'DESCONECTADO'}`);
});