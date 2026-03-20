const express = require('express');
const router = express.Router();
const pool = require('./db'); 
const verifyToken = require('./middlewares/verifyToken');

// Ruta para obtener la lista de casos (Activos o Historial)
router.get('/', verifyToken, async (req, res) => {
    try {
        const usuarioId = req.user.userId;
        const tipoVista = req.query.tipo || 'activos'; // Si no envían nada, por defecto es 'activos'
        
        console.log (req.user)

        // 1. Obtener el rol del usuario
        const usuarioRol = await pool.query(
            `SELECT rol_id FROM usuarios WHERE id = $1`,
            [usuarioId]
        );
        const rolId = usuarioRol.rows[0].rol_id;

        // 2. Preparamos las variables dinámicas
        let condiciones = [];
        let parametros = [];
        let contadorParametros = 1;

        // --- FILTRO POR ESTADO (Activos/En Espera vs Cerrados) ---
        if (tipoVista === 'historial') {
            // Historial: Solo casos cerrados (estado_id = 3 según tu tabla maestra)
            condiciones.push(`c.estado_id = 3`);
            console.log('Mostrando solo casos cerrados (historial)');
        } else {
          console.log('Mostrando casos activos o en espera');
            // Activos: Casos Activos (1) o En Espera (2)
            condiciones.push(`c.estado_id IN (1, 2)`);
        }

        // --- FILTRO POR ROL (Seguridad) ---
        if (rolId !== 5) {
            // Si NO es admin, agregamos la condición de que solo vea sus casos
            condiciones.push(`c.responsable_id = $${contadorParametros}`);
            parametros.push(usuarioId);
            contadorParametros++;
        }

        // Unimos las condiciones con " AND "
        const whereClause = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

        // 3. Ejecutamos la consulta SQL uniendo las tablas (JOIN)
        // Nota: Asumo que tu tabla de clientes se llama 'clientes' y tiene un campo 'nombre'. 
        // Si se llama diferente, solo ajusta esa línea.
        const consultaSQL = `
            SELECT 
                c.expediente_id, 
                cli.nombre_empresa, 
                c.descripcion_corta, 
                c.area_legal, 
                u.nombre_completo AS responsable_nombre, 
                c.creado_en AS fecha_apertura, 
                e.nombre AS estado_nombre,
                c.estado_id
            FROM casos c
            LEFT JOIN clientes cli ON c.cliente_id = cli.id
            JOIN usuarios u ON c.responsable_id = u.id
            JOIN estados_caso e ON c.estado_id = e.id
            ${whereClause}
            ORDER BY c.creado_en DESC;
        `;

        const casosQuery = await pool.query(consultaSQL, parametros);

        // 4. Enviamos la lista al Frontend
        res.json({
            total: casosQuery.rows.length,
            casos: casosQuery.rows
        });

    } catch (error) {
        console.error('Error al obtener la lista de casos:', error);
        res.status(500).json({ error: 'Error al cargar los casos' });
    }
});

module.exports = router;