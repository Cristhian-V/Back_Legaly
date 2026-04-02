// Archivo: listadosRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); 
const verifyToken = require('../middlewares/verifyToken');

// Ruta principal para obtener datos de formularios
router.get('/', verifyToken, async (req, res) => {
    try {
        // 1. Obtener listado de Clientes
        // Solo traemos el ID y el Nombre para no sobrecargar la red con datos innecesarios
        const clientesQuery = await pool.query(
            `SELECT id, nombre_completo 
             FROM clientes 
             ORDER BY nombre_completo ASC`
        );

        // 2. Obtener listado de Usuarios (El equipo legal)
        // Filtramos por estado_id = 1 (Activos)
        const usuariosQuery = await pool.query(
            `SELECT id, nombre_completo, nombre_usuario 
             FROM usuarios 
             WHERE estado_id = 1 
             ORDER BY nombre_completo ASC`
        );

        // 3. Empaquetar y enviar la respuesta al Frontend
        res.json({
            clientes: clientesQuery.rows,
            usuarios: usuariosQuery.rows
        });

    } catch (error) {
        console.error('Error al obtener los listados:', error);
        res.status(500).json({ error: 'Error al cargar las opciones del formulario' });
    }
});

module.exports = router;