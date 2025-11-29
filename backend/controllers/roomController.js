const Room = require('../models/Room');
const Message = require('../models/Message');
const File = require('../models/File');

class RoomController {
    async createRoom(req, res) {
        try {
            const { name, description } = req.body;
            const userId = req.session.user.id;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: 'Nome da sala é obrigatório'
                });
            }

            const room = await Room.createRoom({ name, description }, userId);

            res.json({
                success: true,
                message: 'Sala criada com sucesso!',
                room: room
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getUserRooms(req, res) {
        try {
            const userId = req.session.user.id;
            const rooms = await Room.getUserRooms(userId);

            res.json({
                success: true,
                rooms: rooms
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getRoomMessages(req, res) {
        try {
            const { roomId } = req.params;
            const messages = await Message.getRoomMessages(roomId);

            res.json({
                success: true,
                messages: messages
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getRoomMembers(req, res) {
        try {
            const { roomId } = req.params;
            const members = await Room.getRoomMembers(roomId);

            res.json({
                success: true,
                members: members
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async inviteToRoom(req, res) {
        try {
            const { roomId } = req.params;
            const { email } = req.body;
            const userId = req.session.user.id;

            const userModel = require('../models/User');
            const userToInvite = await userModel.findByEmail(email);

            if (!userToInvite) {
                return res.status(404).json({
                    success: false,
                    error: 'Usuário não encontrado'
                });
            }

            await Room.inviteToRoom(parseInt(roomId), userToInvite.id, userId);

            res.json({
                success: true,
                message: 'Convite enviado com sucesso!'
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getRoomFiles(req, res) {
        try {
            const { roomId } = req.params;
            const files = await Message.getRoomFiles(roomId);

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

    async setRoomActive(req, res) {
        try {
            const { roomId } = req.params;
            const { isActive } = req.body;

            await Room.setRoomActive(roomId, isActive);

            res.json({
                success: true,
                message: `Sala ${isActive ? 'ativada' : 'desativada'} com sucesso!`
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new RoomController();