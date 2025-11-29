const db = require('./Database');

class Room {
    async createRoom(roomData, ownerId) {
        return new Promise(async (resolve, reject) => {
            try {
                const { name, description } = roomData;

                const sql = `INSERT INTO rooms (name, description, owner_id) VALUES (?, ?, ?)`;
                db.getDatabase().run(sql, [name, description, ownerId], async function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        const roomId = this.lastID;
                        await this.addMember(roomId, ownerId, true);
                        
                        resolve({
                            id: roomId,
                            name,
                            description,
                            owner_id: ownerId,
                            is_active: true
                        });
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async addMember(roomId, userId, isAdmin = false) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT OR IGNORE INTO room_members (room_id, user_id, is_admin) VALUES (?, ?, ?)`;
            db.getDatabase().run(sql, [roomId, userId, isAdmin], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async getUserRooms(userId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    r.*,
                    rm.joined_at,
                    rm.is_admin,
                    (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count
                FROM rooms r
                JOIN room_members rm ON r.id = rm.room_id
                WHERE rm.user_id = ?
                ORDER BY r.is_active DESC, r.created_at DESC
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

    async getRoomMembers(roomId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    u.id, u.name, u.email, u.avatar, u.online,
                    rm.joined_at, rm.is_admin
                FROM room_members rm
                JOIN users u ON rm.user_id = u.id
                WHERE rm.room_id = ?
                ORDER BY rm.is_admin DESC, u.online DESC, u.name ASC
            `;
            db.getDatabase().all(sql, [roomId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async inviteToRoom(roomId, userId, inviterId) {
        return new Promise(async (resolve, reject) => {
            try {
                const isMember = await this.isRoomMember(roomId, userId);
                if (isMember) {
                    reject(new Error('Usuário já é membro desta sala'));
                    return;
                }

                await this.addMember(roomId, userId);

                const room = await this.getRoomById(roomId);
                const inviter = await require('./User').findById(inviterId);
                
                await require('./Friendship').createNotification(
                    userId, 
                    'room_invite', 
                    `${inviter.name} convidou você para a sala "${room.name}"`, 
                    roomId
                );

                resolve();

            } catch (error) {
                reject(error);
            }
        });
    }

    async isRoomMember(roomId, userId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?`;
            db.getDatabase().get(sql, [roomId, userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(!!row);
                }
            });
        });
    }

    async getRoomById(roomId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM rooms WHERE id = ?`;
            db.getDatabase().get(sql, [roomId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async setRoomActive(roomId, isActive) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE rooms SET is_active = ? WHERE id = ?`;
            db.getDatabase().run(sql, [isActive, roomId], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

module.exports = new Room();