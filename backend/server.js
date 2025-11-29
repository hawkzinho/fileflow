const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const session = require('express-session');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Criar pastas necessárias
const storagePath = path.join(__dirname, 'storage');
const uploadsPath = path.join(storagePath, 'uploads');

if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
    console.log('📁 Pasta storage criada');
}

if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
    console.log('📁 Pasta uploads criada');
}

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'fileflow-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/storage', express.static(uploadsPath));

// Importar Database e Models
const db = require('./models/Database');
const User = require('./models/User');
const Message = require('./models/Message');

// WebSocket para tempo real
const connectedClients = new Map();

wss.on('connection', (ws, req) => {
    console.log('🔗 Nova conexão WebSocket estabelecida');

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            await handleWebSocketMessage(ws, message);
        } catch (error) {
            console.error('❌ Erro ao processar mensagem WebSocket:', error);
            ws.send(JSON.stringify({
                type: 'error',
                error: 'Erro ao processar mensagem'
            }));
        }
    });

    ws.on('close', () => {
        for (const [userId, client] of connectedClients.entries()) {
            if (client === ws) {
                connectedClients.delete(userId);
                console.log(`👋 Usuário ${userId} desconectado do WebSocket`);
                break;
            }
        }
    });
});

async function handleWebSocketMessage(ws, message) {
    const { type, roomId, content, userId, targetUserId } = message;

    switch (type) {
        case 'authenticate':
            connectedClients.set(userId, ws);
            console.log(`✅ Usuário ${userId} autenticado no WebSocket`);
            await User.setOnlineStatus(userId, true);
            break;

        case 'join_room':
            ws.roomId = roomId;
            console.log(`🎪 Usuário ${userId} entrou na sala ${roomId}`);
            break;

        case 'chat_message':
            const newMessage = await Message.sendMessage({
                room_id: roomId,
                user_id: userId,
                content: content,
                message_type: 'text'
            });

            const user = await User.findById(userId);

            broadcastToRoom(roomId, {
                type: 'new_message',
                message: {
                    ...newMessage,
                    user_name: user.name,
                    user_avatar: user.avatar
                }
            });
            break;

        case 'typing':
            broadcastToRoom(roomId, {
                type: 'user_typing',
                userId: userId,
                userName: (await User.findById(userId)).name
            }, userId);
            break;

        default:
            console.log('❌ Tipo de mensagem WebSocket desconhecido:', type);
    }
}

function broadcastToRoom(roomId, data, excludeUserId = null) {
    connectedClients.forEach((client, userId) => {
        if (client.roomId === roomId && userId !== excludeUserId && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Rotas de API SIMPLES mas FUNCIONAIS
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Nome, email e senha são obrigatórios' 
            });
        }

        const user = await User.register({ name, email, password });
        
        res.json({
            success: true,
            message: 'Usuário cadastrado com sucesso!',
            user: user
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email e senha são obrigatórios' 
            });
        }

        const user = await User.login(email, password);
        req.session.user = user;

        res.json({
            success: true,
            message: 'Login realizado com sucesso!',
            user: user
        });

    } catch (error) {
        res.status(401).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/auth/logout', async (req, res) => {
    try {
        if (req.session.user) {
            await User.setOnlineStatus(req.session.user.id, false);
            req.session.destroy();
        }

        res.json({
            success: true,
            message: 'Logout realizado com sucesso!'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/auth/profile', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                error: 'Não autorizado'
            });
        }

        const user = await User.findById(req.session.user.id);
        res.json({
            success: true,
            user: user
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rotas de Arquivos
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

const File = require('./models/File');

app.post('/api/files/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'Nenhum arquivo enviado' 
            });
        }

        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                error: 'Não autorizado'
            });
        }

        const userId = req.session.user.id;
        const roomId = req.body.roomId || null;

        const result = await File.saveFileMetadata(req.file, userId, roomId);
        
        res.json({
            success: true,
            message: 'Arquivo uploadado com sucesso!',
            fileId: result.insertedId,
            fileInfo: result.fileInfo
        });

    } catch (error) {
        console.error('❌ Erro no upload:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro interno no servidor' 
        });
    }
});

app.get('/api/files', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                error: 'Não autorizado'
            });
        }

        const files = await File.getUserFiles(req.session.user.id);
        res.json({
            success: true,
            files: files
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rotas de Amigos
const Friendship = require('./models/Friendship');

app.post('/api/friends/request', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                error: 'Não autorizado'
            });
        }

        const { email } = req.body;
        const userId = req.session.user.id;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email é obrigatório'
            });
        }

        const result = await Friendship.sendFriendRequest(userId, email);

        res.json({
            success: true,
            message: 'Solicitação de amizade enviada!',
            friendship: result
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/friends', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                error: 'Não autorizado'
            });
        }

        const friends = await Friendship.getUserFriends(req.session.user.id);
        res.json({
            success: true,
            friends: friends
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/friends/requests/pending', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                error: 'Não autorizado'
            });
        }

        const requests = await Friendship.getPendingRequests(req.session.user.id);
        res.json({
            success: true,
            requests: requests
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rotas de Salas
const Room = require('./models/Room');

app.post('/api/rooms', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                error: 'Não autorizado'
            });
        }

        const { name, description } = req.body;
        const userId = req.session.user.id;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Nome da sala é obrigatório'
            });
        }

        const room = await Room.createRoom({ name, description }, userId);

        res.json({
            success: true,
            message: 'Sala criada com sucesso!',
            room: room
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/rooms', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                error: 'Não autorizado'
            });
        }

        const rooms = await Room.getUserRooms(req.session.user.id);
        res.json({
            success: true,
            rooms: rooms
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/rooms/:roomId/messages', async (req, res) => {
    try {
        const { roomId } = req.params;
        const messages = await Message.getRoomMessages(roomId);

        res.json({
            success: true,
            messages: messages
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rotas básicas
app.get('/api/health', async (req, res) => {
    try {
        const database = db.getDatabase();
        await new Promise((resolve, reject) => {
            database.get('SELECT 1', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({
            status: 'healthy',
            database: 'connected',
            websockets: wss.clients.size,
            timestamp: new Date().toISOString(),
            message: '🚀 FileFlow API está funcionando perfeitamente!'
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            database: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/api/info', (req, res) => {
    res.json({
        name: 'FileFlow',
        version: '2.0.0',
        description: 'Sistema completo de compartilhamento de arquivos com salas em tempo real'
    });
});

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Inicialização do servidor
async function startServer() {
    try {
        await db.connect();
        
        server.listen(PORT, () => {
            console.log('='.repeat(60));
            console.log('🚀 FILEFLOW 2.0 - BACKEND DEFINITIVO');
            console.log('='.repeat(60));
            console.log(`📁 Frontend: http://localhost:${PORT}`);
            console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
            console.log(`📊 API Info: http://localhost:${PORT}/api/info`);
            console.log(`🔌 WebSockets: ws://localhost:${PORT}`);
            console.log('='.repeat(60));
            console.log('💾 Database: SQLite ✅');
            console.log('🎪 Salas em tempo real: WebSockets ✅');
            console.log('👥 Sistema de amizades: ✅');
            console.log('📁 Upload de arquivos: ✅');
            console.log('='.repeat(60));
            console.log('👤 Usuário padrão: admin@fileflow.com / 123456');
            console.log('='.repeat(60));
        });

    } catch (error) {
        console.error('❌ FALHA CRÍTICA AO INICIAR SERVIDOR:', error);
        process.exit(1);
    }
}

// Manipulação de desligamento gracioso
process.on('SIGINT', async () => {
    console.log('\n🔴 Recebido SIGINT. Desligando graciosamente...');
    
    for (const [userId, client] of connectedClients.entries()) {
        await User.setOnlineStatus(userId, false);
    }
    
    await db.disconnect();
    server.close(() => {
        console.log('👋 Servidor desligado');
        process.exit(0);
    });
});

// 🚀 INICIAR APLICAÇÃO
startServer();