
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Necesitas iniciar sesión.' });
    }

    try {
        const verificado = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verificado; 
        next(); 
    } catch (error) {
        res.status(400).json({ error: 'Token no válido o expirado.' });
    }
};

module.exports = verifyToken;