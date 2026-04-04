// Archivo: clientesRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); 
const verifyToken = require('../middlewares/verifyToken');

// ==========================================
// 1. OBTENER LISTA DE CLIENTES ACTIVOS (GET)
// ==========================================
/* Se tiene el listado de los clientes en el archivo de listadoRouter
Lo enviamos como catalogo */


// ==========================================
// 2. CREAR UN NUEVO CLIENTE (POST)
// ==========================================
router.post('/', verifyToken, async (req, res) => {
    try {
        const { nombre_completo, categoria_id, email, telefono, direccion } = req.body;

        // Validación de campos obligatorios
        if (!nombre_completo || !categoria_id) {
            return res.status(400).json({ error: 'El nombre completo y la categoría son obligatorios.' });
        }

        const insertQuery = `
            INSERT INTO clientes (nombre_completo, categoria_id, email, telefono, direccion) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING *;
        `;

        const nuevoCliente = await pool.query(insertQuery, [
            nombre_completo, 
            categoria_id, 
            email, 
            telefono, 
            direccion
        ]);

        res.status(201).json({
            message: 'Cliente registrado exitosamente',
            cliente: nuevoCliente.rows[0]
        });
    } catch (error) {
        console.error('Error al crear cliente:', error);
        res.status(500).json({ error: 'Error al intentar registrar al cliente' });
    }
});

// ==========================================
// 3. MODIFICAR UN CLIENTE (PUT)
// ==========================================
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const clienteId = req.params.id;
        const { nombre_completo, categoria_id, email, telefono, direccion } = req.body;

        // Usamos COALESCE para actualizar solo lo que se envía (si un dato viene vacío, conserva el original)
        const updateQuery = `
            UPDATE clientes 
            SET 
                nombre_completo = COALESCE($1, nombre_completo),
                categoria_id = COALESCE($2, categoria_id),
                email = COALESCE($3, email),
                telefono = COALESCE($4, telefono),
                direccion = COALESCE($5, direccion)
            WHERE id = $6 AND estado_id = 1
            RETURNING *;
        `;

        const resultado = await pool.query(updateQuery, [
            nombre_completo, 
            categoria_id, 
            email, 
            telefono, 
            direccion, 
            clienteId
        ]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado o inactivo.' });
        }

        res.json({
            message: 'Datos del cliente actualizados correctamente',
            cliente: resultado.rows[0]
        });
    } catch (error) {
        console.error('Error al modificar cliente:', error);
        res.status(500).json({ error: 'Error al actualizar los datos del cliente' });
    }
});

// ==========================================
// 4. ELIMINACIÓN LÓGICA DE UN CLIENTE (DELETE)
// ==========================================
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const clienteId = req.params.id;

        // Cambiamos el estado_id a 2 (Inactivo)
        const deleteQuery = `
            UPDATE clientes 
            SET estado_id = 2 
            WHERE id = $1
            RETURNING id, nombre_completo, estado_id;
        `;

        const resultado = await pool.query(deleteQuery, [clienteId]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado.' });
        }

        res.json({
            message: 'Cliente eliminado (desactivado) exitosamente',
            cliente: resultado.rows[0]
        });
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        res.status(500).json({ error: 'Error al intentar eliminar el cliente' });
    }
});

module.exports = router;