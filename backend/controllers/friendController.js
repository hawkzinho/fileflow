const Friendship = require('../models/Friendship');
const User = require('../models/User');

class FriendController {
    async sendFriendRequest(req, res) {
        try {
            const { email } = req.body;
            const userId = req.session.user.id;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email é obrigatório'
                });
            }

            const result = await Friendship.sendFriendRequest(userId, email);

            res.json({
                success: true,
                message: 'Solicitação de amizade enviada!',
                friendship: result
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async acceptFriendRequest(req, res) {
        try {
            const { friendshipId } = req.params;
            const userId = req.session.user.id;

            await Friendship.acceptFriendRequest(friendshipId, userId);

            res.json({
                success: true,
                message: 'Solicitação de amizade aceita!'
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getFriends(req, res) {
        try {
            const userId = req.session.user.id;
            const friends = await Friendship.getUserFriends(userId);

            res.json({
                success: true,
                friends: friends
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getPendingRequests(req, res) {
        try {
            const userId = req.session.user.id;
            const requests = await Friendship.getPendingRequests(userId);

            res.json({
                success: true,
                requests: requests
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async removeFriend(req, res) {
        try {
            const { friendshipId } = req.params;
            const userId = req.session.user.id;

            await Friendship.removeFriend(friendshipId, userId);

            res.json({
                success: true,
                message: 'Amizade removida com sucesso!'
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async searchUsers(req, res) {
        try {
            const { query } = req.query;
            const userId = req.session.user.id;

            if (!query) {
                return res.json({
                    success: true,
                    users: []
                });
            }

            const users = await User.searchUsers(query, userId);

            res.json({
                success: true,
                users: users
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new FriendController();