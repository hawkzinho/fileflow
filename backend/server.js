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

// Configuração de Session para PostgreSQL
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'fileflow-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 
    }
};

// Se tiver DATABASE_URL, usa PostgreSQL para sessions
if (process.env.DATABASE_URL) {
    const PostgreSQLStore = require('connect-pg-simple')(session);
    sessionConfig.store = new PostgreSQLStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true
    });
}

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session(sessionConfig));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));

// Criar pasta de uploads se não existir
const uploadsPath = path.join(__dirname, 'storage', 'uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
    console.log('📁 Pasta de uploads criada');
}
app.use('/storage', express.static(uploadsPath));

// Importar e usar rotas
const db = require('./models/Database');
const authRoutes = require('./routes/auth');
const friendRoutes = require('./routes/friends');
const roomRoutes = require('./routes/rooms');
const fileRoutes = require('./routes/files');
const authMiddleware = require('./middleware/auth');

app.use('/api/auth', authRoutes);
app.use('/api/friends', authMiddleware, friendRoutes);
app.use('/api/rooms', authMiddleware, roomRoutes);
app.use('/api/files', authMiddleware, fileRoutes);

// WebSocket
const connectedClients = new Map();
const Message = require('./models/Message');
const User = require('./models/User');

wss.on('connection', (ws) => {
    console.log('🔗 Nova conexão WebSocket');

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            await handleWebSocketMessage(ws, message);
        } catch (error) {
            console.error('❌ Erro WebSocket:', error);
        }
    });

    ws.on('close', () => {
        for (const [userId, client] of connectedClients.entries()) {
            if (client === ws) {
                connectedClients.delete(userId);
                console.log(`👋 Usuário ${userId} desconectado`);
                break;
            }
        }
    });
});

async function handleWebSocketMessage(ws, message) {
    const { type, roomId, content, userId } = message;

    switch (type) {
        case 'authenticate':
            connectedClients.set(userId, ws);
            console.log(`✅ Usuário ${userId} autenticado`);
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
                content: content
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
    }
}

function broadcastToRoom(roomId, data, excludeUserId = null) {
    connectedClients.forEach((client, userId) => {
        if (client.roomId === roomId && userId !== excludeUserId && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Rotas básicas
app.get('/api/health', async (req, res) => {
    try {
        await db.pool.query('SELECT 1');
        res.json({
            status: 'healthy',
            database: 'PostgreSQL connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

app.get('/api/info', (req, res) => {
    res.json({
        name: 'FileFlow',
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Inicialização
async function startServer() {
    try {
        await db.connect();
        
        server.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log('🚀 FILEFLOW 2.0 - PRODUCTION READY');
            console.log('='.repeat(50));
            console.log(`📁 URL: http://localhost:${PORT}`);
            console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
            console.log(`💾 Database: PostgreSQL`);
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('='.repeat(50));
        });

    } catch (error) {
        console.error('❌ Falha ao iniciar servidor:', error);
        process.exit(1);
    }
}

startServer();