const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const session = require('express-session');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Configuração do PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Configuração de Session
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'fileflow-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
};

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session(sessionConfig));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));

// Criar pasta de uploads
const uploadsPath = path.join(__dirname, 'storage', 'uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/storage', express.static(uploadsPath));

// Configuração do Multer
const storage = multer.diskStorage({
    destination: uploadsPath,
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// WebSocket
const connectedClients = new Map();
wss.on('connection', (ws) => {
    console.log('🔗 WebSocket conectado');
    ws.send(JSON.stringify({ type: 'connected', message: 'Bem-vindo!' }));
});

// === ROTAS DE AUTENTICAÇÃO ===
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'Dados incompletos' });
        }

        // Verificar se email já existe
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'Email já cadastrado' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase();

        const result = await pool.query(
            'INSERT INTO users (name, email, password, avatar) VALUES ($1, $2, $3, $4) RETURNING id, name, email, avatar',
            [name, email, hashedPassword, avatar]
        );

        const user = result.rows[0];
        req.session.user = user;

        res.json({ success: true, message: 'Cadastro realizado!', user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email e senha obrigatórios' });
        }

        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Usuário não encontrado' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Senha incorreta' });
        }

        // Atualizar online status
        await pool.query('UPDATE users SET online = true WHERE id = $1', [user.id]);

        const { password: _, ...userWithoutPassword } = user;
        req.session.user = userWithoutPassword;

        res.json({ success: true, message: 'Login realizado!', user: userWithoutPassword });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/logout', async (req, res) => {
    try {
        if (req.session.user) {
            await pool.query('UPDATE users SET online = false WHERE id = $1', [req.session.user.id]);
            req.session.destroy();
        }
        res.json({ success: true, message: 'Logout realizado!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/auth/profile', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        const result = await pool.query(
            'SELECT id, name, email, avatar, online FROM users WHERE id = $1',
            [req.session.user.id]
        );

        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// === ROTAS DE ARQUIVOS ===
app.post('/api/files/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Nenhum arquivo' });
        }

        const result = await pool.query(
            `INSERT INTO files (filename, original_name, size, mimetype, file_path, user_id) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [req.file.filename, req.file.originalname, req.file.size, req.file.mimetype, req.file.path, req.session.user.id]
        );

        res.json({ 
            success: true, 
            message: 'Upload realizado!',
            fileId: result.rows[0].id,
            fileInfo: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/files', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        const result = await pool.query(
            'SELECT * FROM files WHERE user_id = $1 ORDER BY upload_date DESC',
            [req.session.user.id]
        );

        res.json({ success: true, files: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// === ROTAS DE AMIGOS ===
app.post('/api/friends/request', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email obrigatório' });
        }

        // Buscar usuário pelo email
        const friendResult = await pool.query('SELECT id, name FROM users WHERE email = $1', [email]);
        if (friendResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
        }

        const friend = friendResult.rows[0];
        
        // Verificar se já existe solicitação
        const existingResult = await pool.query(
            'SELECT id FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
            [req.session.user.id, friend.id]
        );

        if (existingResult.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'Solicitação já existe' });
        }

        // Criar solicitação
        await pool.query(
            'INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, $3)',
            [req.session.user.id, friend.id, 'pending']
        );

        res.json({ success: true, message: 'Solicitação enviada!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/friends', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        const result = await pool.query(`
            SELECT u.id, u.name, u.email, u.avatar, u.online, f.status, f.id as friendship_id
            FROM friendships f
            JOIN users u ON (f.user_id = u.id OR f.friend_id = u.id) AND u.id != $1
            WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'
            ORDER BY u.online DESC, u.name ASC
        `, [req.session.user.id]);

        res.json({ success: true, friends: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// === ROTAS DE SALAS ===
app.post('/api/rooms', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, error: 'Nome obrigatório' });
        }

        const roomResult = await pool.query(
            'INSERT INTO rooms (name, description, owner_id) VALUES ($1, $2, $3) RETURNING id, name, description',
            [name, description, req.session.user.id]
        );

        const room = roomResult.rows[0];
        
        // Adicionar criador como membro
        await pool.query(
            'INSERT INTO room_members (room_id, user_id, is_admin) VALUES ($1, $2, true)',
            [room.id, req.session.user.id]
        );

        res.json({ success: true, message: 'Sala criada!', room });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/rooms', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Não autorizado' });
        }

        const result = await pool.query(`
            SELECT r.*, rm.joined_at, rm.is_admin,
                   (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count
            FROM rooms r
            JOIN room_members rm ON r.id = rm.room_id
            WHERE rm.user_id = $1
            ORDER BY r.created_at DESC
        `, [req.session.user.id]);

        res.json({ success: true, rooms: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// === ROTAS BÁSICAS ===
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ 
            status: 'healthy', 
            database: 'PostgreSQL connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({ status: 'unhealthy', error: error.message });
    }
});

app.get('/api/info', (req, res) => {
    res.json({ name: 'FileFlow', version: '2.0.0' });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// === INICIALIZAÇÃO ===
async function initializeDatabase() {
    try {
        // Criar tabelas se não existirem
        const tables = [
            `CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                avatar VARCHAR(10),
                online BOOLEAN DEFAULT FALSE,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS files (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                size INTEGER NOT NULL,
                mimetype VARCHAR(100) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                user_id INTEGER REFERENCES users(id),
                room_id INTEGER,
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                download_count INTEGER DEFAULT 0
            )`,

            `CREATE TABLE IF NOT EXISTS rooms (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                owner_id INTEGER REFERENCES users(id),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS room_members (
                id SERIAL PRIMARY KEY,
                room_id INTEGER REFERENCES rooms(id),
                user_id INTEGER REFERENCES users(id),
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_admin BOOLEAN DEFAULT FALSE,
                UNIQUE(room_id, user_id)
            )`,

            `CREATE TABLE IF NOT EXISTS friendships (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                friend_id INTEGER REFERENCES users(id),
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, friend_id)
            )`,

            `CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                room_id INTEGER REFERENCES rooms(id),
                user_id INTEGER REFERENCES users(id),
                content TEXT NOT NULL,
                message_type VARCHAR(20) DEFAULT 'text',
                file_id INTEGER REFERENCES files(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                type VARCHAR(50) NOT NULL,
                content TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                related_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const tableSql of tables) {
            await pool.query(tableSql);
        }

        // Criar usuário admin padrão
        const hashedPassword = await bcrypt.hash('123456', 10);
        await pool.query(
            `INSERT INTO users (name, email, password, avatar) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (email) DO NOTHING`,
            ['Admin FileFlow', 'admin@fileflow.com', hashedPassword, 'AF']
        );

        console.log('✅ Banco de dados inicializado');
        return true;
    } catch (error) {
        console.error('❌ Erro ao inicializar banco:', error);
        return false;
    }
}

// Iniciar servidor
async function startServer() {
    try {
        const dbInitialized = await initializeDatabase();
        if (!dbInitialized) {
            throw new Error('Falha ao inicializar banco de dados');
        }

        server.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log('🚀 FILEFLOW 2.0 - DEPLOY FUNCIONAL');
            console.log('='.repeat(50));
            console.log(`📁 URL: https://seu-app.onrender.com`);
            console.log(`💾 Database: PostgreSQL ✅`);
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('='.repeat(50));
        });
    } catch (error) {
        console.error('❌ Falha ao iniciar:', error);
        process.exit(1);
    }
}

startServer();