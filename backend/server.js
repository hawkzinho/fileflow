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

// Criar pastas
const storagePath = path.join(__dirname, 'storage');
const uploadsPath = path.join(storagePath, 'uploads');

if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'fileflow-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Arquivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/storage', express.static(uploadsPath));

// ✅ AGORA IMPORTE TODOS OS MODULES REAIS
const db = require('./models/Database');
const authRoutes = require('./routes/auth');
const friendRoutes = require('./routes/friends'); 
const roomRoutes = require('./routes/rooms');
const fileRoutes = require('./routes/files');
const authMiddleware = require('./middleware/auth');

// ✅ USE AS ROTAS REAIS
app.use('/api/auth', authRoutes);
app.use('/api/friends', authMiddleware, friendRoutes);
app.use('/api/rooms', authMiddleware, roomRoutes);
app.use('/api/files', authMiddleware, fileRoutes);

// WebSocket real
const connectedClients = new Map();

wss.on('connection', (ws) => {
    console.log('🔗 WebSocket conectado');
    
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            // Aqui vai a lógica real do WebSocket
            ws.send(JSON.stringify({ type: 'echo', message: 'Conectado!' }));
        } catch (error) {
            console.error('❌ Erro WebSocket:', error);
        }
    });
});

// Rotas básicas
app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', message: 'Backend REAL funcionando!' });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Iniciar com Database
async function startServer() {
    try {
        await db.connect();
        
        server.listen(PORT, () => {
            console.log('🚀 FILEFLOW 2.0 - BACKEND REAL');
            console.log(`📁 http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Erro ao iniciar:', error);
    }
}

startServer();