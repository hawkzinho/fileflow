const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'storage', 'fileflow.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Erro ao conectar com SQLite:', err);
                    reject(err);
                } else {
                    console.log('✅ Conectado ao SQLite Database');
                    this.createTables()
                        .then(() => resolve(this.db))
                        .catch(reject);
                }
            });
        });
    }

    async createTables() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                avatar TEXT,
                online BOOLEAN DEFAULT FALSE,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                original_name TEXT NOT NULL,
                size INTEGER NOT NULL,
                mimetype TEXT NOT NULL,
                file_path TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                room_id INTEGER,
                upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                download_count INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (room_id) REFERENCES rooms (id)
            )`,

            `CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                owner_id INTEGER NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES users (id)
            )`,

            `CREATE TABLE IF NOT EXISTS room_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_admin BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (room_id) REFERENCES rooms (id),
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(room_id, user_id)
            )`,

            `CREATE TABLE IF NOT EXISTS friendships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                friend_id INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (friend_id) REFERENCES users (id),
                UNIQUE(user_id, friend_id)
            )`,

            `CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                message_type TEXT DEFAULT 'text',
                file_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (room_id) REFERENCES rooms (id),
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (file_id) REFERENCES files (id)
            )`,

            `CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                related_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`
        ];

        for (const tableSql of tables) {
            await new Promise((resolve, reject) => {
                this.db.run(tableSql, (err) => {
                    if (err) {
                        console.error('❌ Erro ao criar tabela:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }

        console.log('✅ Todas as tabelas criadas/verificadas');
        await this.createDefaultUser();
    }

    async createDefaultUser() {
        const defaultUser = {
            name: 'Admin FileFlow',
            email: 'admin@fileflow.com',
            password: await bcrypt.hash('123456', 10),
            avatar: 'AF'
        };

        return new Promise((resolve, reject) => {
            const sql = `INSERT OR IGNORE INTO users (name, email, password, avatar) VALUES (?, ?, ?, ?)`;
            this.db.run(sql, [defaultUser.name, defaultUser.email, defaultUser.password, defaultUser.avatar], function(err) {
                if (err) {
                    console.error('❌ Erro ao criar usuário padrão:', err);
                    reject(err);
                } else {
                    if (this.changes > 0) {
                        console.log('✅ Usuário admin criado: admin@fileflow.com / 123456');
                    }
                    resolve();
                }
            });
        });
    }

    async disconnect() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('❌ Erro ao fechar conexão:', err);
                        reject(err);
                    } else {
                        console.log('🔌 Desconectado do SQLite');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    getDatabase() {
        return this.db;
    }
}

module.exports = new Database();