// Archivo: listadosRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); 
const verifyToken = require('../middlewares/verifyToken');

// Ruta principal para obtener datos de formularios
router.get('/', verifyToken, async (req, res) => {
    try {
        // 1. Preparamos todas las consultas SIN la palabra "await" al principio
        // Esto crea "Promesas" de que la base de datos nos devolverá algo
        
        const clientesQuery = pool.query(`SELECT id, nombre_completo AS nombre FROM clientes ORDER BY nombre_completo ASC`);
        const usuariosQuery = pool.query(`SELECT id, nombre_completo, nombre_usuario FROM usuarios WHERE estado_id = 1 ORDER BY nombre_completo ASC`);
        
        // --- CATÁLOGOS MAESTROS ---
        const rolesQuery = pool.query(`SELECT id, nombre FROM roles_usuario ORDER BY id ASC`);
        const gradosQuery = pool.query(`SELECT id, nombre FROM grados_academicos ORDER BY id ASC`);
        const categoriasClienteQuery = pool.query(`SELECT id, nombre FROM categorias_cliente ORDER BY id ASC`);
        const estadosCasoQuery = pool.query(`SELECT id, nombre FROM estados_caso ORDER BY id ASC`);
        const areaLegalQuery = pool.query(`SELECT id, nombre FROM area_legal ORDER BY nombre ASC`);
        const tiposEventoQuery = pool.query(`SELECT id, nombre FROM tipos_evento_cal ORDER BY id ASC`);

        // 2. Ejecutamos TODAS las consultas AL MISMO TIEMPO con Promise.all
        // El servidor espera aquí hasta que las 8 consultas terminen de forma simultánea
        const [
            clientesRes, 
            usuariosRes, 
            rolesRes, 
            gradosRes, 
            categoriasRes, 
            estadosCasoRes, 
            areaLegalRes, 
            tiposEventoRes
        ] = await Promise.all([
            clientesQuery, 
            usuariosQuery,
            rolesQuery,
            gradosQuery,
            categoriasClienteQuery,
            estadosCasoQuery,
            areaLegalQuery,
            tiposEventoQuery
        ]);

        // 3. Empaquetamos y enviamos todo súper organizado al Frontend
        res.json({
            clientes: clientesRes.rows,
            usuarios: usuariosRes.rows,
            catalogos: {
                roles_usuario: rolesRes.rows,
                grados_academicos: gradosRes.rows,
                categorias_cliente: categoriasRes.rows,
                estados_caso: estadosCasoRes.rows,
                area_legal: areaLegalRes.rows,
                tipos_evento: tiposEventoRes.rows
            }
        });

    } catch (error) {
        console.error('Error al obtener los listados y catálogos:', error);
        res.status(500).json({ error: 'Error al cargar las opciones del sistema' });
    }
});

module.exports = router;