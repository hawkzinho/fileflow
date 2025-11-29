const db = require('./Database');
const bcrypt = require('bcryptjs');

class User {
    async register(userData) {
        return new Promise(async (resolve, reject) => {
            try {
                const { name, email, password } = userData;
                
                const existingUser = await this.findByEmail(email);
                if (existingUser) {
                    reject(new Error('Email já cadastrado'));
                    return;
                }

                const hashedPassword = await bcrypt.hash(password, 10);
                const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase();

                const sql = `INSERT INTO users (name, email, password, avatar) VALUES (?, ?, ?, ?)`;
                db.getDatabase().run(sql, [name, email, hashedPassword, avatar], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            name,
                            email,
                            avatar,
                            online: false
                        });
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async login(email, password) {
        return new Promise(async (resolve, reject) => {
            try {
                const user = await this.findByEmail(email);
                if (!user) {
                    reject(new Error('Usuário não encontrado'));
                    return;
                }

                const validPassword = await bcrypt.compare(password, user.password);
                if (!validPassword) {
                    reject(new Error('Senha incorreta'));
                    return;
                }

                await this.setOnlineStatus(user.id, true);
                const { password: _, ...userWithoutPassword } = user;
                resolve(userWithoutPassword);

            } catch (error) {
                reject(error);
            }
        });
    }

    async findByEmail(email) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM users WHERE email = ?`;
            db.getDatabase().get(sql, [email], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async findById(id) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT id, name, email, avatar, online, last_seen FROM users WHERE id = ?`;
            db.getDatabase().get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async setOnlineStatus(userId, isOnline) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET online = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?`;
            db.getDatabase().run(sql, [isOnline, userId], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async searchUsers(query, excludeUserId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, name, email, avatar, online, last_seen 
                FROM users 
                WHERE (name LIKE ? OR email LIKE ?) AND id != ?
                LIMIT 10
            `;
            const searchTerm = `%${query}%`;
            db.getDatabase().all(sql, [searchTerm, searchTerm, excludeUserId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getOnlineUsers() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT id, name, email, avatar FROM users WHERE online = TRUE`;
            db.getDatabase().all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}

module.exports = new User();