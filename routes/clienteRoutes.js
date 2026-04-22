const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyToken = require('../middlewares/verifyToken');

// ==================================================================
// MÓDULO 1: GESTIÓN DE CLIENTES
// ==================================================================

// 1. OBTENER TODOS LOS CLIENTES ACTIVOS (GET)
router.get('/', verifyToken, async (req, res) => {
    try {
        const query = `
            SELECT c.*, cat.nombre AS categoria 
            FROM clientes c
            LEFT JOIN categorias_cliente cat ON c.categoria_id = cat.id
            WHERE c.estado = true
            ORDER BY c.creado_en DESC
        `;
        const clientes = await pool.query(query);
        res.json(clientes.rows);
    } catch (error) {
        console.error('Error al obtener clientes:', error);
        res.status(500).json({ error: 'Error al obtener la lista de clientes.' });
    }
});

// 2. CREAR NUEVO CLIENTE (POST)
router.post('/', verifyToken, async (req, res) => {
    try {
        const { nombre_completo, documento_identidad, correo_electronico, telefono, direccion, categoria_id } = req.body;

        const insertQuery = `
            INSERT INTO clientes (nombre_completo, documento_identidad, correo_electronico, telefono, direccion, categoria_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        
        const nuevoCliente = await pool.query(insertQuery, [
            nombre_completo, documento_identidad, correo_electronico, telefono, direccion, categoria_id
        ]);

        res.status(201).json({ message: 'Cliente creado exitosamente', cliente: nuevoCliente.rows[0] });
    } catch (error) {
        console.error('Error al crear cliente:', error);
        res.status(500).json({ error: 'Error al registrar el cliente.' });
    }
});

// 3. MODIFICAR CLIENTE (PUT)
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre_completo, documento_identidad, correo_electronico, telefono, direccion, categoria_id } = req.body;

        const updateQuery = `
            UPDATE clientes 
            SET nombre_completo = $1, documento_identidad = $2, correo_electronico = $3, 
                telefono = $4, direccion = $5, categoria_id = $6
            WHERE id = $7 AND estado = true
            RETURNING *;
        `;
        
        const clienteActualizado = await pool.query(updateQuery, [
            nombre_completo, documento_identidad, correo_electronico, telefono, direccion, categoria_id, id
        ]);

        if (clienteActualizado.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado o eliminado.' });
        }

        res.json({ message: 'Cliente actualizado exitosamente', cliente: clienteActualizado.rows[0] });
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        res.status(500).json({ error: 'Error al actualizar los datos del cliente.' });
    }
});

// 4. ELIMINACIÓN LÓGICA DE CLIENTE (DELETE)
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // La eliminación lógica es simplemente un UPDATE del estado
        const deleteQuery = 'UPDATE clientes SET estado = false WHERE id = $1 RETURNING id';
        const resultado = await pool.query(deleteQuery, [id]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado.' });
        }

        res.json({ message: 'Cliente eliminado exitosamente del sistema.' });
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        res.status(500).json({ error: 'Error al intentar eliminar al cliente.' });
    }
});


// ==================================================================
// MÓDULO 2: GESTIÓN DE CONTACTOS POR CLIENTE
// ==================================================================

// 1. OBTENER CONTACTOS DE UN CLIENTE (GET)
router.get('/:cliente_id/contactos', verifyToken, async (req, res) => {
    try {
        const { cliente_id } = req.params;
        const query = `
            SELECT * FROM contactos_cliente 
            WHERE cliente_id = $1 AND estado = true
            ORDER BY es_principal DESC, creado_en ASC
        `;
        const contactos = await pool.query(query, [cliente_id]);
        res.json(contactos.rows);
    } catch (error) {
        console.error('Error al obtener contactos:', error);
        res.status(500).json({ error: 'Error al obtener los contactos del cliente.' });
    }
});

// 2. CREAR NUEVO CONTACTO (POST)
router.post('/:cliente_id/contactos', verifyToken, async (req, res) => {
    const client = await pool.connect(); // Usamos transacción por la lógica de es_principal
    try {
        const { cliente_id } = req.params;
        const { nombre_contacto, cargo, telefono, email, es_principal } = req.body;

        await client.query('BEGIN');

        // LÓGICA DE NEGOCIO: Si este es el principal, quitamos el trono al anterior
        if (es_principal) {
            await client.query(`
                UPDATE contactos_cliente 
                SET es_principal = false 
                WHERE cliente_id = $1 AND es_principal = true
            `, [cliente_id]);
        }

        const insertQuery = `
            INSERT INTO contactos_cliente (cliente_id, nombre_contacto, cargo, telefono, email, es_principal)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        
        const nuevoContacto = await client.query(insertQuery, [
            cliente_id, nombre_contacto, cargo, telefono, email, es_principal || false
        ]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Contacto registrado', contacto: nuevoContacto.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al crear contacto:', error);
        res.status(500).json({ error: 'Error al registrar el contacto.' });
    } finally {
        client.release();
    }
});

// 3. MODIFICAR CONTACTO (PUT)
router.put('/contactos/:id', verifyToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { nombre_contacto, cargo, telefono, email, es_principal, cliente_id } = req.body;

        await client.query('BEGIN');

        // Si lo marcan como principal, destronamos a los demás de ese mismo cliente
        if (es_principal && cliente_id) {
            await client.query(`
                UPDATE contactos_cliente 
                SET es_principal = false 
                WHERE cliente_id = $1 AND id != $2 AND es_principal = true
            `, [cliente_id, id]);
        }

        const updateQuery = `
            UPDATE contactos_cliente 
            SET nombre_contacto = $1, cargo = $2, telefono = $3, email = $4, es_principal = $5
            WHERE id = $6 AND estado = true
            RETURNING *;
        `;
        
        const contactoActualizado = await client.query(updateQuery, [
            nombre_contacto, cargo, telefono, email, es_principal, id
        ]);

        if (contactoActualizado.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Contacto no encontrado o eliminado.' });
        }

        await client.query('COMMIT');
        res.json({ message: 'Contacto actualizado', contacto: contactoActualizado.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar contacto:', error);
        res.status(500).json({ error: 'Error al actualizar el contacto.' });
    } finally {
        client.release();
    }
});

// 4. ELIMINACIÓN LÓGICA DE CONTACTO (DELETE)
router.delete('/contactos/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const deleteQuery = 'UPDATE contactos_cliente SET estado = false WHERE id = $1 RETURNING id';
        const resultado = await pool.query(deleteQuery, [id]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Contacto no encontrado.' });
        }

        res.json({ message: 'Contacto eliminado exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar contacto:', error);
        res.status(500).json({ error: 'Error al intentar eliminar el contacto.' });
    }
});

module.exports = router;