// Archivo: authRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db'); // Importamos nuestra conexión a Postgres
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');

// Ruta de LOGIN (Inicio de sesión)
router.post('/login', async (req, res) => {
    try {
        const { name_user, password } = req.body;

        // 1. Buscamos al usuario por su email
        const result = await pool.query('SELECT * FROM usuarios WHERE nombre_usuario = $1', [name_user]);

        // Si no hay resultados (rows), el usuario no existe
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = result.rows[0];
        
        // 2. Comparamos la contraseña ingresada con la encriptada en la base de datos
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // 3. Creamos el Token (JWT). Nota: Postgres usa 'id'
        const token = jwt.sign(
            { userId: user.id }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1h' } 
        );

        // 4. Enviamos el token en una Cookie segura
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 3600000
        });

        res.json({ message: 'Inicio de sesión exitoso' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});


// Ruta para verificar si hay una sesión activa
router.get('/verify', verifyToken, async (req, res) => {
    
    try {        
        // Buscamos los datos actualizados del usuario en PostgreSQL
        const result = await pool.query(
            'SELECT id, nombre_usuario, email, rol_id FROM usuarios WHERE id = $1', 
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const user = result.rows[0];

        // Le enviamos los datos al Frontend para que sepa quién está conectado
        res.json({ 
            isAuthenticated: true, 
            user: user 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al verificar la sesión' });
    }
});

// Ruta de LOGOUT (Cerrar sesión)
router.post('/logout', (req, res) => {
    // Usamos clearCookie con exactamente las mismas configuraciones que usamos al crearla
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });

    res.json({ message: 'Sesión cerrada exitosamente' });
});

module.exports = router;