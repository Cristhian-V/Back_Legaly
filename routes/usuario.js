const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db'); // Importamos nuestra conexión a Postgres
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');

// Ruta de Registro
router.post('/register',async (req, res) => {
    try {
        const { 
          name_user, 
          nombre_completo,
          email,          
          password,
          rol_usuario,
          estado_usuario = 1, // Valor por defecto si no se proporciona
          telefono= '',
          biografia = '',
          avatar_url = '',
          creado_en = new Date() // Fecha actual por defecto
        } = req.body;
        
        // 1. Verificar si el nombre de usuario ya existe en la base de datos
        const userExist = await pool.query('SELECT * FROM usuarios WHERE nombre_usuario = $1', [name_user]);
        if (userExist.rows.length > 0) {
            return res.status(400).json({ error: 'El nombre de usuario ya está registrado' });
        }
        
        // 2. Encriptar la contraseña (ahora lo hacemos aquí en la ruta)
        const salt = await bcrypt.genSalt(10);
        
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Guardar el usuario usando SQL
        // El $1 y $2 son parámetros seguros para evitar ataques de Inyección SQL
        const newUser = await pool.query(
            'INSERT INTO usuarios (nombre_usuario, nombre_completo, email, password_hash, rol_id, estado_id, telefono, biografia, avatar_url, creado_en ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
            [name_user, nombre_completo, email, hashedPassword, rol_usuario, estado_usuario, telefono, biografia, avatar_url, creado_en]
        );

        res.status(201).json({ message: 'Usuario creado exitosamente', user: newUser.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
});


// ==========================================
// DATA USUARIOS
// ==========================================
router.get('/data', verifyToken, async (req, res) => {
    try {
        console.log("pasa por aqui")
        const userData = await pool.query(
            `SELECT 
                u.id, 
                u.nombre_usuario, 
                u.nombre_completo, 
                u.email, 
                u.rol_id, 
                r.nombre AS rol_nombre,      -- Nombre real del rol
                u.estado_id, 
                u.telefono, 
                u.biografia, 
                u.avatar_url, 
                u.grado_id,
                g.titulo AS grado_academico_abreviado,
                g.nombre AS grado_academico
            FROM usuarios u
            INNER JOIN roles_usuario r ON u.rol_id = r.id
            LEFT JOIN grados_academicos g ON u.grado_id = g.id `
        ); 
        res.json({ user: userData.rows });
    } catch (error) {
        console.error('Error al obtener datos del usuario:', error);
        res.status(500).json({ error: 'Error al obtener datos del usuario' });
    }
});

// ==========================================
// RUTA 1: DATA USUARIO 
// ==========================================
// Usamos /:id para saber qué usuario específico 
router.get('/data/:id', verifyToken, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const userData = await pool.query(
            `SELECT 
                u.id, 
                u.nombre_usuario, 
                u.nombre_completo, 
                u.email, 
                u.rol_id, 
                r.nombre AS rol_nombre,      -- Nombre real del rol
                u.estado_id, 
                u.telefono, 
                u.biografia, 
                u.avatar_url, 
                u.grado_id,
                g.titulo AS grado_academico_abreviado,
                g.descripcion AS grado_academico_descripcion
            FROM usuarios u
            INNER JOIN roles_usuario r ON u.rol_id = r.id
            LEFT JOIN grados_academicos g ON u.grado_id = g.id 
            WHERE u.id = $1`,
            [targetUserId]
        ); 
        res.json({ user: userData.rows[0] });
    } catch (error) {
        console.error('Error al obtener datos del usuario:', error);
        res.status(500).json({ error: 'Error al obtener datos del usuario' });
    }
});

// ==========================================
// RUTA 2: MODIFICAR USUARIO 
// ==========================================
// Usamos /:id para saber qué usuario específico vamos a modificar
//para habilitar ususarios que hayan sido eliminados logicamente, puede abilitarlos nuevamente desde esta ruta actulizando sus datos.
router.put('/mod/:id', verifyToken, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const { 
            name_user, 
            nombre_completo, 
            email, 
            rol_usuario, 
            telefono, 
            biografia, 
            avatar_url, 
            grado_id 
        } = req.body;

        // 1. Validación de datos OBLIGATORIOS
        if (!grado_id || !telefono) {
            return res.status(400).json({ 
                error: 'Los campos grado_id y telefono son obligatorios para la modificación.' 
            });
        }

        // 2. Consulta de actualización dinámica usando COALESCE
        // COALESCE($1, nombre_ususario) significa: "Si $1 viene vacío/nulo, deja el valor que ya estaba en la columna"
        const updateQuery = `
            UPDATE usuarios 
            SET 
                nombre_usuario = COALESCE($1, nombre_usuario),
                nombre_completo = COALESCE($2, nombre_completo),
                email = COALESCE($3, email),
                rol_id = COALESCE($4, rol_id),
                telefono = $5, -- Este es obligatorio, lo actualizamos directamente
                biografia = COALESCE($6, biografia),
                avatar_url = COALESCE($7, avatar_url),
                grado_id = $8,  -- Este es obligatorio, lo actualizamos directamente
                estado_id = 1 -- Siempre lo dejamos activo al modificar
            WHERE id = $9
            RETURNING id, nombre_usuario, nombre_completo, email, telefono, estado_id;
        `;

        const valores = [
            name_user, 
            nombre_completo, 
            email, 
            rol_usuario, 
            telefono, 
            biografia, 
            avatar_url, 
            grado_id, 
            targetUserId 
        ];

        const resultado = await pool.query(updateQuery, valores);

        // Verificamos si el usuario realmente existía
        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ 
            message: 'Usuario actualizado correctamente', 
            user: resultado.rows[0] 
        });

    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({ error: 'Error al modificar los datos del usuario' });
    }
});

// ==========================================
// RUTA 3: ELIMINACIÓN LÓGICA DE USUARIO
// ==========================================
router.delete('/delete/:id', verifyToken, async (req, res) => {
    try {
        const targetUserId = req.params.id;

        // Cambiamos el estado_id a 2 (Asumiendo que 2 es 'Inactivo' en tu tabla estados_usuario)
        const deleteQuery = `
            UPDATE usuarios 
            SET estado_id = 2 
            WHERE id = $1
            RETURNING id, nombre_usuario, estado_id;
        `;

        const resultado = await pool.query(deleteQuery, [targetUserId]);

        // Verificamos si el usuario existía
        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ 
            message: 'Usuario eliminado (desactivado) exitosamente',
            user: resultado.rows[0]
        });

    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error al intentar eliminar el usuario' });
    }
});


module.exports = router;