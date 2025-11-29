const User = require('../models/User');

class AuthController {
    async register(req, res) {
        try {
            const { name, email, password } = req.body;

            if (!name || !email || !password) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Nome, email e senha são obrigatórios' 
                });
            }

            const user = await User.register({ name, email, password });
            
            res.json({
                success: true,
                message: 'Usuário cadastrado com sucesso!',
                user: user
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Email e senha são obrigatórios' 
                });
            }

            const user = await User.login(email, password);
            
            req.session.user = user;

            res.json({
                success: true,
                message: 'Login realizado com sucesso!',
                user: user
            });

        } catch (error) {
            res.status(401).json({
                success: false,
                error: error.message
            });
        }
    }

    async logout(req, res) {
        try {
            if (req.session.user) {
                await User.setOnlineStatus(req.session.user.id, false);
                req.session.destroy();
            }

            res.json({
                success: true,
                message: 'Logout realizado com sucesso!'
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getProfile(req, res) {
        try {
            const user = await User.findById(req.session.user.id);
            res.json({
                success: true,
                user: user
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async updateProfile(req, res) {
        try {
            const { name } = req.body;
            const userId = req.session.user.id;

            const db = require('../models/Database').getDatabase();
            const sql = `UPDATE users SET name = ? WHERE id = ?`;
            
            db.run(sql, [name, userId], function(err) {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        error: err.message
                    });
                }

                res.json({
                    success: true,
                    message: 'Perfil atualizado com sucesso!'
                });
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new AuthController();