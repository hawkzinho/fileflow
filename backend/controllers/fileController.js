const File = require('../models/File');
const path = require('path');
const fs = require('fs').promises;

class FileController {
    async uploadFile(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Nenhum arquivo enviado' 
                });
            }

            const userId = req.session.user.id;
            const roomId = req.body.roomId || null;

            const result = await File.saveFileMetadata(req.file, userId, roomId);
            
            res.json({
                success: true,
                message: 'Arquivo uploadado com sucesso!',
                fileId: result.insertedId,
                fileInfo: result.fileInfo
            });

        } catch (error) {
            console.error('❌ Erro no upload:', error);
            res.status(500).json({ 
                success: false,
                error: 'Erro interno no servidor' 
            });
        }
    }

    async getUserFiles(req, res) {
        try {
            const userId = req.session.user.id;
            const files = await File.getUserFiles(userId);

            res.json({
                success: true,
                files: files
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async downloadFile(req, res) {
        try {
            const { fileId } = req.params;
            const file = await File.getFileById(fileId);

            if (!file) {
                return res.status(404).json({
                    success: false,
                    error: 'Arquivo não encontrado'
                });
            }

            await File.incrementDownloadCount(fileId);

            res.download(file.file_path, file.original_name, (err) => {
                if (err) {
                    console.error('❌ Erro ao fazer download:', err);
                    res.status(500).json({ 
                        success: false,
                        error: 'Erro ao fazer download' 
                    });
                }
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async deleteFile(req, res) {
        try {
            const { fileId } = req.params;
            const userId = req.session.user.id;

            await File.deleteFile(fileId, userId);

            res.json({
                success: true,
                message: 'Arquivo deletado com sucesso!'
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new FileController();