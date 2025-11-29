const db = require('./Database');

class Message {
    async sendMessage(messageData) {
        return new Promise((resolve, reject) => {
            const { room_id, user_id, content, message_type = 'text', file_id = null } = messageData;

            const sql = `INSERT INTO messages (room_id, user_id, content, message_type, file_id) VALUES (?, ?, ?, ?, ?)`;
            db.getDatabase().run(sql, [room_id, user_id, content, message_type, file_id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        id: this.lastID,
                        room_id,
                        user_id,
                        content,
                        message_type,
                        file_id,
                        created_at: new Date().toISOString()
                    });
                }
            });
        });
    }

    async getRoomMessages(roomId, limit = 50) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    m.*,
                    u.name as user_name,
                    u.avatar as user_avatar
                FROM messages m
                JOIN users u ON m.user_id = u.id
                WHERE m.room_id = ?
                ORDER BY m.created_at DESC
                LIMIT ?
            `;
            db.getDatabase().all(sql, [roomId, limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.reverse());
                }
            });
        });
    }

    async getRoomFiles(roomId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    f.*,
                    u.name as user_name,
                    u.avatar as user_avatar
                FROM files f
                JOIN users u ON f.user_id = u.id
                WHERE f.room_id = ?
                ORDER BY f.upload_date DESC
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
}

module.exports = new Message();