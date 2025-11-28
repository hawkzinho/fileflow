const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// 🔥 CONFIGURAÇÃO CORRIGIDA do Socket.io
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Configurar armazenamento de arquivos
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

// Salas ativas
const rooms = new Map();

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Rota de upload
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

// Socket.io para chat em tempo real
io.on('connection', (socket) => {
  console.log('👤 Usuário conectado:', socket.id);

  // Entrar em uma sala
  socket.on('join-room', (roomId, username) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    // Adicionar usuário à sala
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(username);

    // Notificar outros usuários
    socket.to(roomId).emit('user-joined', username);
    io.to(roomId).emit('users-update', Array.from(rooms.get(roomId)));
    
    console.log(`🚪 ${username} entrou na sala ${roomId}`);
  });

  // Enviar mensagem
  socket.on('send-message', (data) => {
    console.log('💬 Mensagem recebida:', data);
    io.to(data.roomId).emit('new-message', {
      username: data.username,
      message: data.message,
      timestamp: new Date()
    });
  });

  // Compartilhar arquivo
  socket.on('share-file', (fileData) => {
    io.to(fileData.roomId).emit('new-file', fileData);
  });

  // Desconectar
  socket.on('disconnect', () => {
    if (socket.roomId && socket.username) {
      const room = rooms.get(socket.roomId);
      if (room) {
        room.delete(socket.username);
        socket.to(socket.roomId).emit('user-left', socket.username);
        io.to(socket.roomId).emit('users-update', Array.from(room));
        console.log(`👋 ${socket.username} saiu da sala ${socket.roomId}`);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 FileFlow rodando na porta ${PORT}`);
  console.log(`📧 Acesse: http://localhost:${PORT}`);
  console.log('✅ Socket.io configurado e pronto!');
});