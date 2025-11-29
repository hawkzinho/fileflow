const db = require('./Database');
const fs = require('fs').promises;
const path = require('path');

class File {
    async saveFileMetadata(fileData, userId, roomId = null) {
        return new Promise((resolve, reject) => {
            const { filename, originalname, size, mimetype, path: filePath } = fileData;

            const sql = `INSERT INTO files (filename, original_name, size, mimetype, file_path, user_id, room_id) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            db.getDatabase().run(sql, [filename, originalname, size, mimetype, filePath, userId, roomId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log('📁 Arquivo salvo no banco:', this.lastID);
                    resolve({ 
                        insertedId: this.lastID,
                        fileInfo: {
                            filename,
                            originalName: originalname,
                            size,
                            mimetype,
                            path: filePath
                        }
                    });
                }
            });
        });
    }

    async getUserFiles(userId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM files 
                WHERE user_id = ? AND room_id IS NULL
                ORDER BY upload_date DESC
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

    async getFileById(fileId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM files WHERE id = ?`;
            db.getDatabase().get(sql, [fileId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async incrementDownloadCount(fileId) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE files SET download_count = download_count + 1 WHERE id = ?`;
            db.getDatabase().run(sql, [fileId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ modifiedCount: this.changes });
                }
            });
        });
    }

    async deleteFile(fileId, userId) {
        return new Promise(async (resolve, reject) => {
            try {
                const file = await this.getFileById(fileId);
                
                if (!file) {
                    reject(new Error('Arquivo não encontrado'));
                    return;
                }

                if (file.user_id !== userId) {
                    reject(new Error('Você não tem permissão para deletar este arquivo'));
                    return;
                }

                try {
                    await fs.unlink(file.file_path);
                } catch (fsError) {
                    console.warn('⚠️ Arquivo físico não encontrado, continuando...');
                }

                const sql = `DELETE FROM files WHERE id = ?`;
                db.getDatabase().run(sql, [fileId], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ deletedCount: this.changes });
                    }
                });

            } catch (error) {
                reject(error);
            }
        });
    }
}

module.exports = new File();