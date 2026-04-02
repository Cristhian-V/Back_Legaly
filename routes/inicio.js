const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyToken = require('../middlewares/verifyToken');
const { route } = require('./authRoutes');


router.get('/userData', verifyToken, async (req, res) => {
    try {
        const usuarioId = req.user.userId;
        // Consulta SQL para obtener los datos del usuario junto con el nombre del rol
        const dataUsuario = await pool.query(
            `SELECT u.id, u.nombre_completo, r.nombre AS rol, u.avatar_url 
             FROM usuarios u
             JOIN roles_usuario r ON u.rol_id = r.id
             WHERE u.id = $1`,
            [usuarioId]
        );
        // 6. Enviamos una sola respuesta limpia
        res.json({ dataUsuario: dataUsuario.rows[0] });
    } catch (error) {
        console.error('Error al obtener datos del usuario:', error);
        res.status(500).json({ error: 'Error al obtener datos del usuario' });
    }
});

router.get('/casosUsusario', verifyToken, async (req, res) => {
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

        // 3. Si NO es administrador (rol 1), agregamos las condiciones y el ID
        if (rolId !== 1) {
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

        const EvntosActivosQuery = await pool.query(
            `SELECT COUNT(*) FROM eventos_calendario e
             JOIN casos c ON e.caso_id = c.caso_id
             WHERE c.estado_id IN (1,2)
                AND e.fecha_hora >= CURRENT_DATE
                AND e.fecha_hora <= CURRENT_DATE + INTERVAL '30 days' ${filtroEventos}`,
            parametrosEventos
        );
        const totalEventosActivos = parseInt(EvntosActivosQuery.rows[0].count);

        // 5. Ejecutamos la consulta de Eventos (inyectando el filtro si existe)
        const EventosQuery = await pool.query(
            `SELECT e.id, e.titulo, e.fecha_hora, t.nombre AS tipo_evento, c.expediente_id
             FROM eventos_calendario e
             JOIN tipos_evento_cal t ON e.tipo_evento_id = t.id
             LEFT JOIN casos c ON e.caso_id = c.caso_id
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
                eventosActivos: totalEventosActivos
            },
            Eventos: Eventos
        });

    } catch (error) {
        console.error('Error al cargar el INICIO:', error);
        res.status(500).json({ error: 'Error al cargar los datos del inicio' });
    }
});

router.get('/eventos', verifyToken, async (req, res) => {
    try {
        const usuarioId = req.user.userId;
        // 1. Obtener el rol del usuario
        const usuarioRol = await pool.query(
            `SELECT rol_id FROM usuarios WHERE id = $1`,
            [usuarioId]
        );
        const rolId = usuarioRol.rows[0].rol_id;
        // 2. Preparamos las variables para nuestras consultas dinámicas
        let filtroEventos = '';
        let parametrosEventos = [];
        if (rolId !== 1) {
            // Si NO es admin, filtramos por responsable o eventos sin caso asignado
            filtroEventos = 'AND (c.responsable_id = $1 OR e.caso_id IS NULL)';
            parametrosEventos = [usuarioId];
        }
        // 3. Ejecutamos la consulta de Eventos (inyectando el filtro si existe)
        const EventosQuery = await pool.query(
            `SELECT 
            CAST(e.fecha_hora AS DATE) AS fecha,           -- Extrae solo la fecha
            CAST(e.fecha_hora AS TIME) AS hora,           -- Extrae solo la hora
            t.nombre AS tipo,                             
            e.titulo,
            e.descripcion                                 
            FROM eventos_calendario e
            JOIN tipos_evento_cal t ON e.tipo_evento_id = t.id
            LEFT JOIN casos c ON e.caso_id = c.caso_id
            WHERE e.fecha_hora >= CURRENT_DATE - INTERVAL '10 days' 
            AND e.fecha_hora <= CURRENT_DATE + INTERVAL '20 days'
            ${filtroEventos}
            ORDER BY e.fecha_hora ASC;`,
            parametrosEventos
        );
        const Eventos = EventosQuery.rows;

        // 4. Enviamos una sola respuesta limpia
        res.json({
            Eventos: Eventos
        });

    } catch (error) {
        console.error('Error al cargar los eventos:', error);
        res.status(500).json({ error: 'Error al cargar los datos de los eventos' });
    }
});


module.exports = router;