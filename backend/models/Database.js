const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

class Database {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://localhost/fileflow',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
    }

    async connect() {
        try {
            await this.pool.query('SELECT 1');
            console.log('✅ Conectado ao PostgreSQL');
            await this.createTables();
            return this.pool;
        } catch (error) {
            console.error('❌ Erro ao conectar com PostgreSQL:', error);
            throw error;
        }
    }

    async createTables() {
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
            try {
                await this.pool.query(tableSql);
            } catch (error) {
                console.error('❌ Erro ao criar tabela:', error);
            }
        }

        console.log('✅ Todas as tabelas criadas/verificadas');
        await this.createDefaultUser();
    }

    async createDefaultUser() {
        try {
            const hashedPassword = await bcrypt.hash('123456', 10);
            await this.pool.query(
                `INSERT INTO users (name, email, password, avatar) 
                 VALUES ($1, $2, $3, $4) 
                 ON CONFLICT (email) DO NOTHING`,
                ['Admin FileFlow', 'admin@fileflow.com', hashedPassword, 'AF']
            );
            console.log('✅ Usuário admin verificado');
        } catch (error) {
            console.error('❌ Erro ao criar usuário padrão:', error);
        }
    }

    async disconnect() {
        await this.pool.end();
        console.log('🔌 Desconectado do PostgreSQL');
    }

    getDatabase() {
        return this.pool;
    }
}

module.exports = new Database();