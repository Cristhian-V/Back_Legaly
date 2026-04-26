const express = require("express");
const router = express.Router();
const pool = require("../db");
const verifyToken = require("../middlewares/verifyToken");
const { registrarHistorial } = require("../utils/historialHelper");

// Obtener eventos del calendario global
router.get("/", verifyToken, async (req, res) => {
  try {
    const usuarioId = req.user.userId;
    const rolId = await pool.query(
      `SELECT rol_id FROM usuarios WHERE id = $1`,
      [usuarioId],
    );
    const rolIdValue = rolId.rows[0].rol_id;
    console.log(
      `Usuario ID ${usuarioId} con Rol ID ${rolIdValue} está solicitando eventos del calendario.`,
    );
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
    console.error("Error al obtener eventos del calendario:", error);
    res
      .status(500)
      .json({ error: "Error interno al obtener los eventos del calendario." });
  }
});

// ==========================================
// Obtener eventos de un CASO ESPECÍFICO (GET)
router.get("/caso/:caso_id", verifyToken, async (req, res) => {
  try {
    const casoId = req.params.caso_id;

    // Consulta directa: Traemos todos los eventos que pertenezcan a este caso_id
    const query = `
SELECT c.expediente_id,
             eCal.id AS evento_id, 
             eCal.titulo, 
             eCal.descripcion, 
             eCal.fecha_hora, 
             te.nombre AS tipo_evento
      FROM eventos_calendario eCal
      JOIN casos c ON c.caso_id = eCal.caso_id
      JOIN tipos_evento_cal te ON te.id = eCal.tipo_evento_id
      WHERE c.expediente_id = $1
      ORDER BY eCal.fecha_hora ASC
    `;

    const eventos = await pool.query(query, [casoId]);

    // Devolvemos el array de eventos
    res.json(eventos.rows);
  } catch (error) {
    console.error("Error al obtener eventos del caso:", error);
    res
      .status(500)
      .json({ error: "Error interno al obtener los eventos del caso." });
  }
});

// Crear un nuevo evento en el calendario
router.post("/", verifyToken, async (req, res) => {
  try {
    const usuarioId = req.user.userId;
    const { titulo, descripcion, fecha_hora, tipo_evento_id, caso_id } =
      req.body;

    const crearEventoQuery = await pool.query(
      `INSERT INTO eventos_calendario (titulo, descripcion, fecha_hora, tipo_evento_id, caso_id)
       VALUES ($1, $2, $3, $4,
       (select caso_id from casos where expediente_id = $5)) RETURNING *`,
      [titulo, descripcion, fecha_hora, tipo_evento_id, caso_id],
    );

    const casoId = crearEventoQuery.rows[0].caso_id;

    // Registrar en el historial del caso
    await registrarHistorial(
      casoId,
      usuarioId,
      "creacion_evento",
      "titulo del evento: " + titulo,
      "Descripción del evento: " + descripcion,
    );

    res.json({
      message: "Evento creado exitosamente",
      evento: crearEventoQuery.rows[0].id,
    });
  } catch (error) {
    console.error("Error al crear evento en el calendario:", error);
    res
      .status(500)
      .json({ error: "Error interno al crear el evento en el calendario." });
  }
});

// ==========================================
// Modificar un evento existente (PUT)
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const eventoId = req.params.id;
    const usuarioId = req.user.userId;
    const { titulo, descripcion, fecha_hora, tipo_evento_id } = req.body;

    // Actualizamos el evento y pedimos que nos retorne los datos actualizados
    // Nota: Normalmente el caso_id no se cambia, por lo que no lo actualizamos
    const updateQuery = await pool.query(
      `UPDATE eventos_calendario 
       SET titulo = $1, descripcion = $2, fecha_hora = $3, tipo_evento_id = $4
       WHERE id = $5 
       RETURNING *`,
      [titulo, descripcion, fecha_hora, tipo_evento_id, eventoId],
    );

    if (updateQuery.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "El evento no existe o ya fue eliminado." });
    }

    const eventoActualizado = updateQuery.rows[0];

    // Registrar en el historial del caso
    await registrarHistorial(
      eventoActualizado.caso_id,
      usuarioId,
      "modificacion_evento", // Asegúrate de tener este código en tu tabla tipos_historial_caso
      "Evento Modificado: " + titulo,
      "Se actualizaron los detalles o la fecha del evento en el calendario.",
    );

    res.json({
      message: "Evento actualizado exitosamente",
      evento: eventoActualizado,
    });
  } catch (error) {
    console.error("Error al modificar evento en el calendario:", error);
    res.status(500).json({ error: "Error interno al modificar el evento." });
  }
});

// ==========================================
// Eliminar un evento del calendario (DELETE)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const eventoId = req.params.id;
    const usuarioId = req.user.userId;

    // Eliminamos el evento físicamente y retornamos el caso_id y titulo para el historial
    const deleteQuery = await pool.query(
      `DELETE FROM eventos_calendario 
       WHERE id = $1 
       RETURNING caso_id, titulo`,
      [eventoId],
    );

    if (deleteQuery.rows.length === 0) {
      return res.status(404).json({ error: "El evento no existe." });
    }

    const { caso_id, titulo } = deleteQuery.rows[0];

    // Registrar en el historial del caso que se borró el evento
    await registrarHistorial(
      caso_id,
      usuarioId,
      "eliminacion_evento", // Asegúrate de tener este código en tu tabla tipos_historial_caso
      "Evento Eliminado: " + titulo,
      "El evento fue cancelado o eliminado del calendario.",
    );

    res.json({ message: "Evento eliminado exitosamente del calendario." });
  } catch (error) {
    console.error("Error al eliminar evento en el calendario:", error);
    res.status(500).json({ error: "Error interno al eliminar el evento." });
  }
});

module.exports = router;
