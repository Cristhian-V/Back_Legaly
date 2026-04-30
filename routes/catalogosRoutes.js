const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyToken = require('../middlewares/verifyToken');

// 1. DICCIONARIO DE SEGURIDAD (Whitelist)
// Esto evita la Inyección SQL asegurando que solo puedan consultar estas tablas.
const tablasPermitidas = {
    'tipos-evento': 'tipos_evento_cal',
    'roles': 'roles_usuario',
    'grados': 'grados_academicos',
    'categorias-cliente': 'categorias_cliente',
    'area-legal': 'area_legal'
};

// Middleware interno para verificar si el catálogo existe
const verificarCatalogo = (req, res, next) => {
    const tabla = tablasPermitidas[req.params.catalogo];
    if (!tabla) {
        return res.status(400).json({ error: 'El catálogo solicitado no existe o no está permitido.' });
    }
    req.nombreTabla = tabla; // Guardamos el nombre real de la tabla para usarlo en las rutas
    next();
};

// ==========================================
// 1. OBTENER TODOS LOS REGISTROS (GET)
// ==========================================
router.get('/:catalogo', verifyToken, verificarCatalogo, async (req, res) => {
    try {
        // Traemos todos para que el panel de admin pueda ver incluso los inactivos
        const query = `SELECT * FROM ${req.nombreTabla} ORDER BY id ASC`;
        const resultado = await pool.query(query);
        res.json(resultado.rows);
    } catch (error) {
        console.error(`Error al obtener ${req.nombreTabla}:`, error);
        res.status(500).json({ error: `Error al obtener el catálogo.` });
    }
});

// ==========================================
// 2. CREAR UN NUEVO REGISTRO (POST)
// ==========================================
router.post('/:catalogo', verifyToken, verificarCatalogo, async (req, res) => {
    try {
        const data = req.body;
        const columnas = Object.keys(data);
        const valores = Object.values(data);

        if (columnas.length === 0) return res.status(400).json({ error: 'No se enviaron datos.' });

        // Construcción dinámica: INSERT INTO tabla (col1, col2) VALUES ($1, $2)
        const placeholders = columnas.map((_, index) => `$${index + 1}`).join(', ');
        const query = `
            INSERT INTO ${req.nombreTabla} (${columnas.join(', ')}) 
            VALUES (${placeholders}) 
            RETURNING *;
        `;

        const resultado = await pool.query(query, valores);
        res.status(201).json({ message: 'Registro creado', data: resultado.rows[0] });
    } catch (error) {
        console.error(`Error al crear en ${req.nombreTabla}:`, error);
        res.status(500).json({ error: 'Error interno al crear el registro.' });
    }
});

// ==========================================
// 3. ACTUALIZAR UN REGISTRO (PUT)
// ==========================================
router.put('/:catalogo/:id', verifyToken, verificarCatalogo, async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
        const columnas = Object.keys(data);
        const valores = Object.values(data);

        if (columnas.length === 0) return res.status(400).json({ error: 'No se enviaron datos para actualizar.' });

        // Construcción dinámica: UPDATE tabla SET col1 = $1, col2 = $2 WHERE id = $3
        const setClause = columnas.map((col, index) => `${col} = $${index + 1}`).join(', ');
        valores.push(id); // Añadimos el ID al final del arreglo de valores

        const query = `
            UPDATE ${req.nombreTabla} 
            SET ${setClause} 
            WHERE id = $${valores.length} 
            RETURNING *;
        `;

        const resultado = await pool.query(query, valores);

        if (resultado.rows.length === 0) return res.status(404).json({ error: 'Registro no encontrado.' });
        res.json({ message: 'Registro actualizado', data: resultado.rows[0] });

    } catch (error) {
        console.error(`Error al actualizar en ${req.nombreTabla}:`, error);
        res.status(500).json({ error: 'Error interno al actualizar el registro.' });
    }
});

// ==========================================
// 4. ELIMINACIÓN LÓGICA (DELETE)
// ==========================================
router.delete('/:catalogo/:id', verifyToken, verificarCatalogo, async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            UPDATE ${req.nombreTabla} 
            SET activo = false 
            WHERE id = $1 
            RETURNING id;
        `;

        const resultado = await pool.query(query, [id]);

        if (resultado.rows.length === 0) return res.status(404).json({ error: 'Registro no encontrado.' });
        res.json({ message: 'Registro desactivado exitosamente.' });

    } catch (error) {
        console.error(`Error al desactivar en ${req.nombreTabla}:`, error);
        res.status(500).json({ error: 'Error interno al intentar desactivar el registro.' });
    }
});

// ==========================================
// 5. HABILITACION LÓGICA
// ==========================================
router.put('/:catalogo/:id/activar', verifyToken, verificarCatalogo, async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            UPDATE ${req.nombreTabla} 
            SET activo = true 
            WHERE id = $1 
            RETURNING id;
        `;

        const resultado = await pool.query(query, [id]);

        if (resultado.rows.length === 0) return res.status(404).json({ error: 'Registro no encontrado.' });
        res.json({ message: 'Registro activado exitosamente.' });

    } catch (error) {
        console.error(`Error al activar en ${req.nombreTabla}:`, error);
        res.status(500).json({ error: 'Error interno al intentar activar el registro.' });
    }
});

module.exports = router;