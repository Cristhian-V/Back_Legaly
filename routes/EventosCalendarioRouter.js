const express = require("express");
const router = express.Router();
const pool = require("../db");
const verifyToken = require("../middlewares/verifyToken");
const autorizarCaso = require("../middlewares/autorizarCaso");
const { registrarHistorial } = require("../utils/historialHelper");

const MODALIDADES_VALIDAS = ["virtual", "presencial"];

// Obtener eventos del calendario global (casos + usuarios)
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

    // Rol 1 (Admin) -> Ve TODOS los eventos de casos y de usuarios
    if (rolIdValue === 1) {
      query = `
        SELECT 'caso' AS origen, c.expediente_id, eCal.id AS evento_id,
               eCal.titulo, eCal.descripcion, eCal.fecha_hora,
               te.nombre AS tipo_evento, eCal.modalidad AS modalidad, NULL AS creado_por
        FROM casos c
        JOIN eventos_calendario eCal ON eCal.caso_id = c.caso_id
        JOIN tipos_evento_cal te ON te.id = eCal.tipo_evento_id

        UNION ALL

        SELECT 'usuario' AS origen, NULL AS expediente_id, eu.id AS evento_id,
               eu.titulo, eu.descripcion, eu.fecha_hora,
               te.nombre AS tipo_evento, eu.modalidad AS modalidad, u.nombre_completo AS creado_por
        FROM eventos_usuarios eu
        JOIN tipos_evento_cal te ON te.id = eu.tipo_evento_id
        JOIN usuarios u ON u.id = eu.creado_por_id

        ORDER BY fecha_hora ASC
      `;
      values = [];
    }
    // Otros roles -> Eventos de casos donde son responsable o parte del equipo + eventos de usuario propios
    else {
      query = `
        SELECT 'caso' AS origen, c.expediente_id, eCal.id AS evento_id,
               eCal.titulo, eCal.descripcion, eCal.fecha_hora,
               te.nombre AS tipo_evento, eCal.modalidad AS modalidad, NULL AS creado_por
        FROM casos c
        JOIN eventos_calendario eCal ON eCal.caso_id = c.caso_id
        JOIN tipos_evento_cal te ON te.id = eCal.tipo_evento_id
        WHERE c.responsable_id = $1
           OR c.caso_id IN (SELECT caso_id FROM equipo_caso WHERE usuario_id = $1)

        UNION ALL

        SELECT 'usuario' AS origen, NULL AS expediente_id, eu.id AS evento_id,
               eu.titulo, eu.descripcion, eu.fecha_hora,
               te.nombre AS tipo_evento, eu.modalidad AS modalidad, u.nombre_completo AS creado_por
        FROM eventos_usuarios eu
        JOIN tipos_evento_cal te ON te.id = eu.tipo_evento_id
        JOIN usuarios u ON u.id = eu.creado_por_id
        WHERE eu.creado_por_id = $1
           OR eu.id IN (SELECT evento_id FROM participantes_evento WHERE usuario_id = $1)

        ORDER BY fecha_hora ASC
      `;
      values = [usuarioId];
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
router.get("/caso/:caso_id", verifyToken, autorizarCaso({ clave: "caso_id" }), async (req, res) => {
  try {
    const casoId = req.params.caso_id;

    // Consulta directa: Traemos todos los eventos que pertenezcan a este caso_id
    const query = `
SELECT c.expediente_id,
             eCal.id AS evento_id, 
             eCal.titulo, 
             eCal.descripcion, 
             eCal.fecha_hora, 
             eCal.modalidad,
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
router.post("/", verifyToken, autorizarCaso({ fuente: "body", clave: "caso_id" }), async (req, res) => {
  try {
    const usuarioId = req.user.userId;
    const { titulo, descripcion, fecha_hora, tipo_evento_id, caso_id, modalidad } =
      req.body;

    if (!MODALIDADES_VALIDAS.includes(modalidad)) {
      return res
        .status(400)
        .json({ error: "La modalidad debe ser 'virtual' o 'presencial'." });
    }

    const crearEventoQuery = await pool.query(
      `INSERT INTO eventos_calendario (titulo, descripcion, fecha_hora, tipo_evento_id, caso_id, modalidad)
       VALUES ($1, $2, $3, $4,
       (select caso_id from casos where expediente_id = $5), $6) RETURNING *`,
      [titulo, descripcion, fecha_hora, tipo_evento_id, caso_id, modalidad],
    );

    const casoId = crearEventoQuery.rows[0].caso_id;
    const eventoId = crearEventoQuery.rows[0].id;

    // Todo el equipo del caso queda como participante (pendiente de confirmar)
    await pool.query(
      `INSERT INTO participantes_evento (tipo_evento, evento_id, usuario_id)
       SELECT 'caso', $1, e.usuario_id
       FROM equipo_caso e
       WHERE e.caso_id = $2
       ON CONFLICT (tipo_evento, evento_id, usuario_id) DO NOTHING`,
      [eventoId, casoId],
    );

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
// OBTENER PARTICIPANTES DE UN EVENTO (GET /participantes)
// ==========================================
router.get("/participantes", verifyToken, async (req, res) => {
  try {
    const { tipo_evento, evento_id } = req.query;

    if (!["caso", "usuario"].includes(tipo_evento) || !evento_id) {
      return res.status(400).json({
        error: "Debes indicar tipo_evento ('caso'|'usuario') y evento_id.",
      });
    }

    // Para eventos de caso, validamos el acceso al expediente
    if (tipo_evento === "caso") {
      const casoId = await autorizarCaso.resolverPorEvento(evento_id);
      if (!casoId) {
        return res.status(404).json({ error: "El evento no existe." });
      }
      const permitido = await autorizarCaso.puedeAccederCaso(req.user.userId, casoId);
      if (!permitido) {
        return res.status(403).json({ error: "No tienes acceso a este expediente." });
      }
    }

    const participantes = await pool.query(
      `SELECT p.usuario_id, p.estado_asistencia, p.comentario, p.respondido_en,
              u.nombre_completo, u.avatar_url
       FROM participantes_evento p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.tipo_evento = $1 AND p.evento_id = $2
       ORDER BY u.nombre_completo ASC`,
      [tipo_evento, evento_id],
    );

    res.json({ participantes: participantes.rows });
  } catch (error) {
    console.error("Error al obtener participantes del evento:", error);
    res.status(500).json({ error: "Error interno al obtener los participantes." });
  }
});

// ==========================================
// REGISTRAR ASISTENCIA DE UN PARTICIPANTE (PUT /asistencia)
// ==========================================
router.put("/asistencia", verifyToken, async (req, res) => {
  try {
    const usuarioId = req.user.userId;
    const { tipo_evento, evento_id, estado_asistencia, comentario } = req.body;

    if (!["caso", "usuario"].includes(tipo_evento)) {
      return res
        .status(400)
        .json({ error: "tipo_evento debe ser 'caso' o 'usuario'." });
    }
    if (!evento_id) {
      return res.status(400).json({ error: "Falta evento_id." });
    }
    if (!["confirmado", "no_asiste"].includes(estado_asistencia)) {
      return res.status(400).json({
        error: "estado_asistencia debe ser 'confirmado' o 'no_asiste'.",
      });
    }
    if (estado_asistencia === "no_asiste" && (!comentario || !String(comentario).trim())) {
      return res.status(400).json({
        error: "Debes indicar un comentario cuando no asistirás.",
      });
    }

    // Solo se actualiza el propio registro (WHERE usuario_id = usuario autenticado)
    const update = await pool.query(
      `UPDATE participantes_evento
       SET estado_asistencia = $1,
           comentario = $2,
           respondido_en = CURRENT_TIMESTAMP
       WHERE tipo_evento = $3 AND evento_id = $4 AND usuario_id = $5
       RETURNING usuario_id, estado_asistencia, comentario, respondido_en`,
      [
        estado_asistencia,
        estado_asistencia === "no_asiste" ? comentario : null,
        tipo_evento,
        evento_id,
        usuarioId,
      ],
    );

    if (update.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "No eres participante de este evento." });
    }

    res.json({
      message: "Asistencia registrada.",
      participante: update.rows[0],
    });
  } catch (error) {
    console.error("Error al registrar asistencia:", error);
    res
      .status(500)
      .json({ error: "Error interno al registrar la asistencia." });
  }
});

// ==========================================
// Modificar un evento existente (PUT)
router.put("/:id", verifyToken, autorizarCaso({ resolver: autorizarCaso.resolverPorEvento }), async (req, res) => {
  try {
    const eventoId = req.params.id;
    const usuarioId = req.user.userId;
    const { titulo, descripcion, fecha_hora, tipo_evento_id, modalidad } = req.body;

    if (modalidad !== undefined && !MODALIDADES_VALIDAS.includes(modalidad)) {
      return res
        .status(400)
        .json({ error: "La modalidad debe ser 'virtual' o 'presencial'." });
    }

    // Actualizamos el evento y pedimos que nos retorne los datos actualizados
    // Nota: Normalmente el caso_id no se cambia, por lo que no lo actualizamos
    const updateQuery = await pool.query(
      `UPDATE eventos_calendario 
       SET titulo = $1, descripcion = $2, fecha_hora = $3, tipo_evento_id = $4, modalidad = COALESCE($5, modalidad)
       WHERE id = $6 
       RETURNING *`,
      [titulo, descripcion, fecha_hora, tipo_evento_id, modalidad ?? null, eventoId],
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
router.delete("/:id", verifyToken, autorizarCaso({ resolver: autorizarCaso.resolverPorEvento }), async (req, res) => {
  try {
    const eventoId = req.params.id;
    const usuarioId = req.user.userId;

    // Eliminamos los participantes asociados (no hay FK por ser polimórfico)
    await pool.query(
      "DELETE FROM participantes_evento WHERE tipo_evento = 'caso' AND evento_id = $1",
      [eventoId],
    );

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

// ==========================================
// OBTENER SOLO EVENTOS DE USUARIO (GET /usuario)
// ==========================================
router.get("/usuario", verifyToken, async (req, res) => {
  try {
    const usuarioId = req.user.userId;
    const rolId = await pool.query(
      `SELECT rol_id FROM usuarios WHERE id = $1`,
      [usuarioId],
    );
    const rolIdValue = rolId.rows[0].rol_id;

    let query = "";
    let values = [];

    if (rolIdValue === 1) {
      query = `
        SELECT eu.id AS evento_id, eu.titulo, eu.descripcion, eu.fecha_hora,
               te.nombre AS tipo_evento, eu.modalidad AS modalidad,
               u.nombre_completo AS creado_por, eu.creado_por_id
        FROM eventos_usuarios eu
        JOIN tipos_evento_cal te ON te.id = eu.tipo_evento_id
        JOIN usuarios u ON u.id = eu.creado_por_id
        ORDER BY eu.fecha_hora ASC
      `;
      values = [];
    } else {
      query = `
        SELECT eu.id AS evento_id, eu.titulo, eu.descripcion, eu.fecha_hora,
               te.nombre AS tipo_evento, eu.modalidad AS modalidad,
               u.nombre_completo AS creado_por, eu.creado_por_id
        FROM eventos_usuarios eu
        JOIN tipos_evento_cal te ON te.id = eu.tipo_evento_id
        JOIN usuarios u ON u.id = eu.creado_por_id
        WHERE eu.creado_por_id = $1
           OR eu.id IN (SELECT evento_id FROM participantes_evento WHERE usuario_id = $1)
        ORDER BY eu.fecha_hora ASC
      `;
      values = [usuarioId];
    }

    const eventos = await pool.query(query, values);
    res.json(eventos.rows);
  } catch (error) {
    console.error("Error al obtener eventos de usuario:", error);
    res.status(500).json({ error: "Error interno al obtener los eventos de usuario." });
  }
});

// ==========================================
// CREAR EVENTO DE USUARIO (POST /usuario)
// ==========================================
router.post("/usuario", verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const usuarioId = req.user.userId;
    const { titulo, descripcion, fecha_hora, tipo_evento_id, participantes_ids, modalidad } = req.body;

    if (!titulo || !fecha_hora || !tipo_evento_id) {
      return res.status(400).json({ error: "titulo, fecha_hora y tipo_evento_id son obligatorios." });
    }

    if (!MODALIDADES_VALIDAS.includes(modalidad)) {
      return res.status(400).json({ error: "La modalidad debe ser 'virtual' o 'presencial'." });
    }

    await client.query("BEGIN");

    const nuevoEvento = await client.query(
      `INSERT INTO eventos_usuarios (titulo, descripcion, fecha_hora, tipo_evento_id, creado_por_id, modalidad)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [titulo, descripcion || null, fecha_hora, tipo_evento_id, usuarioId, modalidad],
    );

    const eventoId = nuevoEvento.rows[0].id;

    // Insertar al creador como participante
    await client.query(
      `INSERT INTO participantes_evento (tipo_evento, evento_id, usuario_id)
       VALUES ('usuario', $1, $2)
       ON CONFLICT (tipo_evento, evento_id, usuario_id) DO NOTHING`,
      [eventoId, usuarioId],
    );

    // Insertar participantes adicionales si se enviaron
    if (participantes_ids && Array.isArray(participantes_ids) && participantes_ids.length > 0) {
      for (const participanteId of participantes_ids) {
        await client.query(
          `INSERT INTO participantes_evento (tipo_evento, evento_id, usuario_id)
           VALUES ('usuario', $1, $2)
           ON CONFLICT (tipo_evento, evento_id, usuario_id) DO NOTHING`,
          [eventoId, participanteId],
        );
      }
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Evento de usuario creado exitosamente.",
      evento_id: eventoId,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al crear evento de usuario:", error);
    res.status(500).json({ error: "Error interno al crear el evento de usuario." });
  } finally {
    client.release();
  }
});

// ==========================================
// ELIMINAR EVENTO DE USUARIO (DELETE /usuario/:id)
// ==========================================
router.delete("/usuario/:id", verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const eventoId = req.params.id;
    const usuarioId = req.user.userId;

    // Verificar que el evento existe y que el usuario es el creador
    const evento = await client.query(
      `SELECT id, titulo, creado_por_id FROM eventos_usuarios WHERE id = $1`,
      [eventoId],
    );

    if (evento.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: "El evento no existe." });
    }

    if (evento.rows[0].creado_por_id !== usuarioId) {
      client.release();
      return res.status(403).json({ error: "Solo el creador del evento puede eliminarlo." });
    }

    await client.query("BEGIN");

    await client.query(
      `DELETE FROM participantes_evento WHERE tipo_evento = 'usuario' AND evento_id = $1`,
      [eventoId],
    );

    await client.query(
      `DELETE FROM eventos_usuarios WHERE id = $1`,
      [eventoId],
    );

    await client.query("COMMIT");

    res.json({ message: "Evento de usuario eliminado exitosamente." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al eliminar evento de usuario:", error);
    res.status(500).json({ error: "Error interno al eliminar el evento de usuario." });
  } finally {
    client.release();
  }
});

module.exports = router;
