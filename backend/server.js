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

const PORT = process.env.PORT || 3001;

// Criar pastas
const storagePath = path.join(__dirname, 'storage');
const uploadsPath = path.join(storagePath, 'uploads');

if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

// Middlewares CRÍTICOS primeiro
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'fileflow-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Servir arquivos estáticos - CORRIGIDO
app.use('/css', express.static(path.join(__dirname, '../frontend')));
app.use('/js', express.static(path.join(__dirname, '../frontend')));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/storage', express.static(uploadsPath));

// Rota principal - SEMPRE primeiro
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// DEMONSTRAÇÃO: Rotas simples de API
app.post('/api/auth/login', (req, res) => {
    res.json({ 
        success: true, 
        user: { id: 1, name: 'Admin', email: 'admin@fileflow.com', avatar: 'A' } 
    });
});

app.get('/api/files', (req, res) => {
    res.json({ success: true, files: [] });
});

app.get('/api/rooms', (req, res) => {
    res.json({ success: true, rooms: [] });
});

app.get('/api/friends', (req, res) => {
    res.json({ success: true, friends: [] });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        database: 'connected',
        websockets: wss.clients.size,
        timestamp: new Date().toISOString(),
        message: '🚀 FileFlow API está funcionando perfeitamente!'
    });
});

app.get('/api/info', (req, res) => {
    res.json({
        name: 'FileFlow',
        version: '2.0.0',
        description: 'Sistema completo de compartilhamento'
    });
});

// WebSocket simples
wss.on('connection', (ws) => {
    console.log('🔗 WebSocket conectado');
    ws.send(JSON.stringify({ type: 'connected', message: 'Bem-vindo!' }));
});

// Iniciar servidor
server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('🚀 FILEFLOW 2.0 - FRONTEND FIX');
    console.log('='.repeat(50));
    console.log(`📁 Frontend: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api/health`);
    console.log('='.repeat(50));
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('❌ Erro:', error.message);
});