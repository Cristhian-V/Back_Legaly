const express = require('express');
const router = express.Router();
const pool = require('./db'); 
const verifyToken = require('./middlewares/verifyToken');

router.get('/', verifyToken, async (req, res) => {
    try {
        const usuarioId = req.user.userId;
        
        // 1. Obtener el rol del usuario
        const usuarioRol = await pool.query(
            `SELECT rol_id FROM usuarios WHERE id = $1`,
            [usuarioId]
        );
        const rolId = usuarioRol.rows[0].rol_id;

        // 2. Preparamos las variables para nuestras consultas dinámicas
        // Empezamos asumiendo que es administrador (sin filtros de ID)
        let filtroCasos = '';
        let filtroEventos = '';
        let parametrosCasos = [];
        let parametrosEventos = [];

        // 3. Si NO es administrador (rol 5), agregamos las condiciones y el ID
        if (rolId !== 5) {
            filtroCasos = 'AND responsable_id = $1';
            // Para eventos, filtramos por responsable o eventos sin caso asignado
            filtroEventos = 'AND (c.responsable_id = $1 OR e.caso_id IS NULL)'; 
            
            // Agregamos el ID del usuario a los parámetros que se enviarán a Postgres
            parametrosCasos = [usuarioId];
            parametrosEventos = [usuarioId];
        }

        // 4. Ejecutamos la consulta de Casos Activos (inyectando el filtro si existe)
        const casosActivosQuery = await pool.query(
            `SELECT COUNT(*) FROM casos 
             WHERE estado_id IN (1,2) AND sub_estado = 'Activo' ${filtroCasos}`,
            parametrosCasos
        );
        const totalCasosActivos = parseInt(casosActivosQuery.rows[0].count);

        // 5. Ejecutamos la consulta de Eventos (inyectando el filtro si existe)
        const EventosQuery = await pool.query(
            `SELECT e.id, e.titulo, e.fecha_hora, t.nombre AS tipo_evento, c.expediente_id
             FROM eventos_calendario e
             JOIN tipos_evento_cal t ON e.tipo_evento_id = t.id
             LEFT JOIN casos c ON e.caso_id = c.expediente_id
             WHERE e.fecha_hora >= CURRENT_DATE - INTERVAL '10 days' 
               AND e.fecha_hora <= CURRENT_DATE + INTERVAL '20 days'
               AND c.estado_id IN (1,2)
               ${filtroEventos}
             ORDER BY e.fecha_hora ASC;`,
            parametrosEventos
        );
        const Eventos = EventosQuery.rows;

        // 6. Enviamos una sola respuesta limpia
        res.json({
            resumen: {
                casosActivos: totalCasosActivos,
            },
            Eventos: Eventos
        });

    } catch (error) {
        console.error('Error al cargar el INICIO:', error);
        res.status(500).json({ error: 'Error al cargar los datos del inicio' });
    }
});

module.exports = router;