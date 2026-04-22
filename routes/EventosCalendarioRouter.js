const express = require("express");
const router = express.Router();
const pool = require("../db");
const verifyToken = require("../middlewares/verifyToken");
const { registrarHistorial } = require("../utils/historialHelper");

// Obtener eventos del calendario
router.get("/", verifyToken, async (req, res) => {
  try {
    const usuarioId = req.user.userId;
    const rolId = await pool.query(`SELECT rol_id FROM usuarios WHERE id = $1`, [usuarioId]); 
    const rolIdValue = rolId.rows[0].rol_id;
    console.log(`Usuario ID ${usuarioId} con Rol ID ${rolIdValue} está solicitando eventos del calendario.`);
    let query = "";
    let values = [];

    // Si es un Abogado Socio / Admin (Rol 1) -> Ve TODOS los eventos
    if (rolIdValue === 1) {
      query = `
        SELECT c.expediente_id,
               eCal.id AS evento_id, 
               eCal.titulo, 
               eCal.descripcion, 
               eCal.fecha_hora, 
               te.nombre AS tipo_evento
        FROM casos c
        JOIN eventos_calendario eCal ON eCal.caso_id = c.caso_id
        JOIN tipos_evento_cal te ON te.id = eCal.tipo_evento_id
        ORDER BY eCal.fecha_hora ASC
      `;
      values = []; // No filtramos por usuario_id
    } 
    // Si es cualquier otro rol -> Ve SOLO los eventos de los casos donde es parte del equipo
    else {
      query = `
        SELECT c.expediente_id,
               eCal.id AS evento_id, 
               eCal.titulo, 
               eCal.descripcion, 
               eCal.fecha_hora, 
               te.nombre AS tipo_evento
        FROM casos c
        JOIN equipo_caso e ON c.caso_id = e.caso_id
        JOIN eventos_calendario eCal ON eCal.caso_id = c.caso_id
        JOIN tipos_evento_cal te ON te.id = eCal.tipo_evento_id
        WHERE e.usuario_id = $1
        ORDER BY eCal.fecha_hora ASC
      `;
      values = [usuarioId]; // Filtramos por su ID
    }

    const eventos = await pool.query(query, values);
    res.json(eventos.rows);

  } catch (error) {
    console.error('Error al obtener eventos del calendario:', error);
    res.status(500).json({ error: 'Error interno al obtener los eventos del calendario.' });
  }
});

// Crear un nuevo evento en el calendario
router.post("/", verifyToken, async (req, res) => {
  try {
    const usuarioId = req.user.userId;
    const { titulo, descripcion, fecha_hora, tipo_evento_id, caso_id } = req.body;

    const crearEventoQuery = await pool.query(
      `INSERT INTO eventos_calendario (titulo, descripcion, fecha_hora, tipo_evento_id, caso_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [titulo, descripcion, fecha_hora, tipo_evento_id, caso_id]
    );

    const casoId = crearEventoQuery.rows[0].caso_id;    

    // Registrar en el historial del caso
    await registrarHistorial(
      casoId,
      usuarioId,
      'creacion_evento',
      'titulo del evento: ' + titulo,
      'Descripción del evento: ' + descripcion
    );

    res.json({ message: 'Evento creado exitosamente', evento: crearEventoQuery.rows[0].id });
  } catch (error) {
    console.error('Error al crear evento en el calendario:', error);
    res.status(500).json({ error: 'Error interno al crear el evento en el calendario.' });
  }
});


module.exports = router;