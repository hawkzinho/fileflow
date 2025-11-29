const db = require('./Database');

class Friendship {
    async sendFriendRequest(userId, friendEmail) {
        return new Promise(async (resolve, reject) => {
            try {
                const userModel = require('./User');
                const friend = await userModel.findByEmail(friendEmail);
                
                if (!friend) {
                    reject(new Error('Usuário não encontrado'));
                    return;
                }

                if (userId === friend.id) {
                    reject(new Error('Você não pode adicionar a si mesmo'));
                    return;
                }

                const existingRequest = await this.getFriendship(userId, friend.id);
                if (existingRequest) {
                    if (existingRequest.status === 'pending') {
                        reject(new Error('Solicitação de amizade já enviada'));
                    } else if (existingRequest.status === 'accepted') {
                        reject(new Error('Vocês já são amigos'));
                    }
                    return;
                }

                const sql = `INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, 'pending')`;
                db.getDatabase().run(sql, [userId, friend.id], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        this.createNotification(friend.id, 'friend_request', 
                            `${(require('./User').findById(userId)).name} enviou uma solicitação de amizade`, 
                            userId
                        );
                        
                        resolve({
                            id: this.lastID,
                            user_id: userId,
                            friend_id: friend.id,
                            status: 'pending'
                        });
                    }
                }.bind(this));

            } catch (error) {
                reject(error);
            }
        });
    }

    async acceptFriendRequest(friendshipId, userId) {
        return new Promise(async (resolve, reject) => {
            try {
                const request = await this.getFriendshipById(friendshipId);
                if (!request || request.friend_id !== userId) {
                    reject(new Error('Solicitação não encontrada'));
                    return;
                }

                const sql = `UPDATE friendships SET status = 'accepted' WHERE id = ?`;
                db.getDatabase().run(sql, [friendshipId], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        this.createNotification(request.user_id, 'friend_accepted',
                            `${(require('./User').findById(userId)).name} aceitou sua solicitação de amizade`,
                            userId
                        );
                        resolve();
                    }
                }.bind(this));

            } catch (error) {
                reject(error);
            }
        });
    }

    async getFriendship(userId, friendId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`;
            db.getDatabase().get(sql, [userId, friendId, friendId, userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getFriendshipById(friendshipId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM friendships WHERE id = ?`;
            db.getDatabase().get(sql, [friendshipId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getUserFriends(userId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    f.id as friendship_id,
                    f.status,
                    f.created_at,
                    u.id,
                    u.name,
                    u.email,
                    u.avatar,
                    u.online,
                    u.last_seen
                FROM friendships f
                JOIN users u ON (f.user_id = u.id OR f.friend_id = u.id) AND u.id != ?
                WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
                ORDER BY u.online DESC, u.name ASC
            `;
            db.getDatabase().all(sql, [userId, userId, userId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getPendingRequests(userId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    f.id as friendship_id,
                    f.created_at,
                    u.id,
                    u.name,
                    u.email,
                    u.avatar
                FROM friendships f
                JOIN users u ON f.user_id = u.id
                WHERE f.friend_id = ? AND f.status = 'pending'
                ORDER BY f.created_at DESC
            `;
            db.getDatabase().all(sql, [userId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async createNotification(userId, type, content, relatedId = null) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)`;
            db.getDatabase().run(sql, [userId, type, content, relatedId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async removeFriend(friendshipId, userId) {
        return new Promise(async (resolve, reject) => {
            try {
                const friendship = await this.getFriendshipById(friendshipId);
                if (!friendship || (friendship.user_id !== userId && friendship.friend_id !== userId)) {
                    reject(new Error('Amizade não encontrada'));
                    return;
                }

                const sql = `DELETE FROM friendships WHERE id = ?`;
                db.getDatabase().run(sql, [friendshipId], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });

            } catch (error) {
                reject(error);
            }
        });
    }
}

module.exports = new Friendship();