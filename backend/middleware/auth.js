const User = require('../models/User');

const authMiddleware = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            error: 'Não autorizado. Faça login primeiro.'
        });
    }

    User.findById(req.session.user.id)
        .then(user => {
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Usuário não encontrado'
                });
            }
            req.user = user;
            next();
        })
        .catch(error => {
            res.status(500).json({
                success: false,
                error: 'Erro ao verificar usuário'
            });
        });
};

module.exports = authMiddleware;