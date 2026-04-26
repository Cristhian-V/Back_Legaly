const express = require("express");
const router = express.Router();
const pool = require("../db");
const verifyToken = require("../middlewares/verifyToken");
const { registrarHistorial } = require("../utils/historialHelper");

// Ruta para obtener la lista de casos (Activos o Historial)
router.get("/", verifyToken, async (req, res) => {
  try {
    const usuarioId = req.user.userId;
    const tipoVista = req.query.tipo || "activos"; // Si no envían nada, por defecto es 'activos'

    // 1. Obtener el rol del usuario
    const usuarioRol = await pool.query(
      `SELECT rol_id FROM usuarios WHERE id = $1`,
      [usuarioId],
    );
    const rolId = usuarioRol.rows[0].rol_id;

    // 2. Preparamos las variables dinámicas
    let condiciones = [];
    let parametros = [];
    let contadorParametros = 1;

    // --- FILTRO POR ESTADO (Activos/En Espera vs Cerrados) ---
    if (tipoVista === "historial") {
      // Historial: Solo casos cerrados (estado_id = 3 según tu tabla maestra)
      condiciones.push(`c.estado_id = 3`);
    } else {
      // Activos: Casos Activos (1) o En Espera (2)
      condiciones.push(`c.estado_id IN (1, 2)`);
    }

    // --- FILTRO POR ROL (Seguridad y Equipo) ---
    if (rolId !== 1) {
      // Si NO es admin, ve casos donde es responsable principal O donde está en la tabla equipo_caso
      condiciones.push(`
                (c.responsable_id = $${contadorParametros} OR 
                 c.caso_id IN (SELECT caso_id FROM equipo_caso WHERE usuario_id = $${contadorParametros}))
            `);
      parametros.push(usuarioId);
      contadorParametros++;
    }

    // Unimos las condiciones con " AND "
    const whereClause =
      condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

    // 3. Ejecutamos la consulta SQL
    const consultaSQL = `
            SELECT 
                c.expediente_id, 
                cli.nombre_completo AS cliente_nombre, 
                c.descripcion_corta, 
                a.nombre AS area_legal,
                u.nombre_completo AS responsable_nombre, 
                TO_CHAR(c.creado_en, 'DD/MM/YYYY') AS fecha_apertura,
                erev.descripcion AS estado_nombre
            FROM casos c
            LEFT JOIN clientes cli ON c.cliente_id = cli.id
            JOIN usuarios u ON c.responsable_id = u.id
            JOIN estados_caso e ON c.estado_id = e.id
            JOIN area_legal a ON c.area_legal_id = a.id
            JOIN estado_revision erev ON erev.id = c.estado_revision_id
            ${whereClause}
            ORDER BY c.creado_en DESC;
        `;

    const casosQuery = await pool.query(consultaSQL, parametros);

    // 4. Enviamos la lista al Frontend
    res.json({
      total: casosQuery.rows.length,
      casos: casosQuery.rows,
    });
  } catch (error) {
    console.error("Error al obtener la lista de casos:", error);
    res.status(500).json({ error: "Error al cargar los casos" });
  }
});

// ==========================================
// RUTA: CREAR UN NUEVO CASO (POST)
// ==========================================
router.post("/", verifyToken, async (req, res) => {
  // Solicitamos un cliente exclusivo para la transacción
  const client = await pool.connect();

  try {
    // 1. Extraemos los datos que envía el Frontend
    const {
      area_legal_id, // Obligatorio (Ej: "1-porp intlec", "2-D.Soc", "3-Litigio", etc.)
      cliente_id, // Obligatorio (ID del cliente asociado)
      responsable_id, // Obligatorio (ID del abogado a cargo)
      descripcion_corta, // Obligatorio (Título o resumen del caso)
      descripcion_completa, // Opcional (Descripción detallada del caso)
      contraparte = null, // Opcional (Nombre de la contraparte)
      fecha_inicio = new Date(), // Opcional (Fecha de inicio del caso)
    } = req.body;

    // 2. Validación de campos obligatorios
    if (
      !area_legal_id ||
      !cliente_id ||
      !descripcion_corta ||
      !descripcion_completa ||
      !responsable_id
    ) {
      return res.status(400).json({
        error:
          "Los campos area_legal, cliente_id, descripcion_corta, descripcion_completa, y responsable_id son obligatorios.",
      });
    }

    const estado_id = 1; // Por defecto, el caso se crea como "Activo"
    const sub_estado = "Activo"; // Sub-estado inicial
    const creado_en = new Date(); // Fecha actual

    // 3. INICIAMOS LA TRANSACCIÓN SEGURA
    await client.query("BEGIN");

    // 4. Guardar el caso en PostgreSQL
    const insertQuery = `
            INSERT INTO casos 
            (area_legal_id, expediente_id, cliente_id, responsable_id, descripcion_corta, descripcion_completa, contraparte, fecha_inicio, fecha_cierre, estado_id, sub_estado, creado_en) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
            RETURNING caso_id; 
        `;

    const valores = [
      area_legal_id,
      "TEMP", // Temporal mientras generamos el ID definitivo
      cliente_id,
      responsable_id,
      descripcion_corta,
      descripcion_completa,
      contraparte,
      fecha_inicio,
      null, // fecha_cierre
      estado_id,
      sub_estado,
      creado_en,
    ];

    const nuevoCaso = await client.query(insertQuery, valores);
    const casoIdGenerado = nuevoCaso.rows[0].caso_id;

    // 5. Generar y actualizar el expediente_id (Ej: "EXP-2026-0001")
    const anioActual = new Date().getFullYear();
    const expedienteId = `EXP-${anioActual}-${String(casoIdGenerado).padStart(4, "0")}`;

    await client.query(
      `UPDATE casos SET expediente_id = $1 WHERE caso_id = $2`,
      [expedienteId, casoIdGenerado],
    );

    // =========================================================
    // 6. NUEVO: INSERTAR AL RESPONSABLE EN EL EQUIPO DEL CASO
    // =========================================================
    // Usamos ON CONFLICT DO NOTHING por seguridad, aunque al ser un caso nuevo no debería haber conflictos
    await client.query(
      `INSERT INTO equipo_caso (caso_id, usuario_id) 
         VALUES ($1, $2) ON CONFLICT (caso_id, usuario_id) DO NOTHING`,
      [casoIdGenerado, responsable_id],
    );

    // REGISTRAR EN EL HISTORIAL DE AUDITORÍA
    await registrarHistorial(
      casoIdGenerado,
      req.user.userId,
      "creacion", // Asegúrate de tener este código en tu catálogo
      "Creacion del Caso",
      " Asignación de número interno para la gestión administrativa del Expediente.",
    );

    // 7. CONFIRMAMOS LA TRANSACCIÓN (Guardamos todo de forma permanente)
    await client.query("COMMIT");

    // 8. Obtenemos los datos finales para enviarlos al Frontend
    // Usamos pool.query normal porque la transacción ya terminó
    const casoCreado = await pool.query(
      `SELECT * FROM casos WHERE caso_id = $1`,
      [casoIdGenerado],
    );

    // 9. Enviamos respuesta de éxito
    res.status(201).json({
      message: "Caso creado y responsable asignado al equipo exitosamente.",
      caso: casoCreado.rows[0],
    });
  } catch (error) {
    // Si cualquier paso (insertar caso, actualizar ID, insertar equipo) falla,
    // deshacemos TODO para no tener datos corruptos.
    await client.query("ROLLBACK");
    console.error("Error al crear caso:", error);
    res
      .status(500)
      .json({ error: "Error interno al intentar crear el nuevo caso." });
  } finally {
    // Siempre liberamos el cliente de vuelta al pool
    client.release();
  }
});

// ==========================================
// RUTA DE EQUIPO LEGAL DEL CASO (GET /casos/equipo)
// ==========================================
router.get("/equipo", verifyToken, async (req, res) => {
  try {
    const { expediente_id } = req.query;
    const equipoQuery = `
            SELECT 
              u.id,
              u.nombre_completo,
              u.avatar_url,
              u.email,
              u.telefono,
              g.titulo,
              g.nombre AS descripcion_titulo
            FROM casos c
            JOIN equipo_caso e ON e.caso_id = c.caso_id
            JOIN usuarios u ON u.id = e.usuario_id
            JOIN grados_academicos g ON g.id = u.grado_id
            WHERE c.expediente_id = $1
            `;
    const equipo = await pool.query(equipoQuery, [expediente_id]);

    res.json({ equipo: equipo.rows });
  } catch (error) {
    console.error("Error al obtener el equipo del caso:", error);
    res
      .status(500)
      .json({ error: "Error interno al intentar obtener el equipo del caso" });
  }
});

// ==========================================
// RUTA: agregar un miembro al equipo legal del caso (POST /casos/equipo)
// ==========================================
router.post("/equipo", verifyToken, async (req, res) => {
  try {
    const { expediente_id, usuario_id } = req.body;
    const insertQuery = `
            INSERT INTO equipo_caso (caso_id, usuario_id) 
            VALUES ((SELECT caso_id FROM casos WHERE expediente_id = $1), $2);
        `;
    const nuevoMiembro = await pool.query(insertQuery, [
      expediente_id,
      usuario_id,
    ]);
    res.status(201).json({
      message: "Miembro agregado al equipo legal del caso",
    });
  } catch (error) {
    console.error("Error al agregar miembro al equipo del caso:", error);
    res.status(500).json({
      error: "Error interno al intentar agregar miembro al equipo del caso",
    });
  }
});

// ==========================================
// RUTA: eliminar un miembro del equipo legal del caso (DELETE /casos/equipo)
// ==========================================
router.delete("/equipo", verifyToken, async (req, res) => {
  try {
    const { expediente_id, usuario_id } = req.body;
    const deleteQuery = `
            DELETE FROM equipo_caso 
            WHERE usuario_id = $1 AND caso_id = (SELECT caso_id FROM casos WHERE expediente_id = $2);
        `;
    await pool.query(deleteQuery, [usuario_id, expediente_id]);
    res.json({
      message: "Miembro eliminado del equipo legal del caso",
    });
  } catch (error) {
    console.error("Error al eliminar miembro del equipo del caso:", error);
    res.status(500).json({
      error: "Error interno al intentar eliminar miembro del equipo del caso",
    });
  }
});

// ==========================================
// RUTA: OBTENER HISTORIAL DE UN CASO (GET)
// ==========================================
router.get("/:id/historial", verifyToken, async (req, res) => {
  try {
    const casoId = req.params.id;

    // 1. Buscamos el ID numérico interno del caso (si envían el expediente_id como CIV-2024-001)
    const casoData = await pool.query(
      `SELECT caso_id FROM casos WHERE expediente_id = $1`,
      [casoId],
    );
    if (casoData.rows.length === 0) {
      return res.status(404).json({ error: "Caso no encontrado" });
    }

    const idInterno = casoData.rows[0].caso_id;

    // 2. Consulta SQL: Traemos todo ordenado desde el más reciente al más antiguo
    const queryHistorial = `
            SELECT 
                h.id,
                t.codigo AS tipo,
                h.titulo,
                h.descripcion,
                TO_CHAR(h.fecha_hito, 'YYYY-MM-DD') AS fecha_agrupacion, -- Ej: 2026-04-16 (Usada para agrupar)
                TO_CHAR(h.fecha_hito, 'DD/MM/YYYY') AS fecha_formateada, -- Ej: 16/04/2026 (Para mostrar)
                TO_CHAR(h.fecha_hito, 'HH12:MI AM') AS hora,             -- Ej: 02:25 PM
                u.nombre_completo AS autor_nombre,
                u.id AS autor_id,
                u.avatar_url AS autor_avatar
            FROM historial_caso h
            JOIN tipos_historial_caso t ON h.tipo_historial_id = t.id
            LEFT JOIN usuarios u ON h.usuario_id = u.id
            WHERE h.caso_id = $1
            ORDER BY h.fecha_hito DESC;
        `;

    const historialDB = await pool.query(queryHistorial, [idInterno]);

    // 3.  Agrupamos los datos por fecha usando JavaScript
    const historialAgrupado = historialDB.rows.reduce((acumulador, evento) => {
      const fecha = evento.fecha_agrupacion; // Usamos YYYY-MM-DD como llave

      // Si es la primera vez que vemos esta fecha, creamos un grupo para ella
      if (!acumulador[fecha]) {
        acumulador[fecha] = {
          fecha_etiqueta: evento.fecha_formateada, // Lo que verá el usuario
          eventos: [],
        };
      }

      // Metemos el evento dentro del grupo de su fecha
      acumulador[fecha].eventos.push({
        id: evento.id,
        tipo: evento.tipo,
        titulo: evento.titulo,
        descripcion: evento.descripcion,
        hora: evento.hora,
        autor: evento.autor_nombre || "Sistema", // Si es null, decimos que fue el Sistema
        autor_id: evento.autor_id,
        avatar: evento.autor_avatar,
      });

      return acumulador;
    }, {});

    // 4. Convertimos el objeto agrupado en un Array ordenado para que React lo lea fácilmente con un .map()
    const resultadoFinal = Object.values(historialAgrupado);

    res.json({
      total_eventos: historialDB.rows.length,
      historial: resultadoFinal,
    });
  } catch (error) {
    console.error("Error al obtener el historial:", error);
    res
      .status(500)
      .json({ error: "Error interno al cargar la bitácora del caso." });
  }
});

// ==========================================
// RUTA: OBTENER HISTORIAL DE REVISIONES DE UN CASO (GET)
// ==========================================
// Ejemplo: GET /api/casos/EXP-2024-001/revisionActiva
router.get("/:id/revisionActiva", verifyToken, async (req, res) => {
  try {
    const parametroId = req.params.id; // Puede ser el expediente_id (ej. EXP-2024-001

    // 1. OBTENER EL ID INTERNO DEL CASO
    // Convertimos el expediente de la URL al caso_id numérico
    const casoQuery = await pool.query(
      "SELECT caso_id FROM casos WHERE expediente_id = $1",
      [parametroId],
    );

    if (casoQuery.rows.length === 0) {
      return res.status(404).json({ error: "El caso especificado no existe." });
    }

    const casoId = casoQuery.rows[0].caso_id;

    const idActivoQuery = await pool.query(
      "SELECT id FROM revisiones_caso WHERE caso_id = $1 and activo = true",
      [casoId],
    );
    const idActivo = idActivoQuery.rows[0].id;

    res.json({
      id_activo: idActivo,
    });
  } catch (error) {
    console.error("Error al obtener el historial de revisiones:", error);
    res
      .status(500)
      .json({ error: "Error interno al cargar el historial del caso." });
  }
});

// ==========================================
// ENVIAR CASO / DOCUMENTOS A REVISIÓN (POST) SOLICITUD DE REVSION
// ==========================================
router.post("/:id/revisiones", verifyToken, async (req, res) => {
  // Para transacciones seguras, pedimos un "cliente" temporal a la base de datos
  const client = await pool.connect();

  try {
    const parametroId = req.params.id; // Puede ser el expediente_id (ej. EXP-2026-001)
    const solicitanteId = req.user.userId;
    const { revisor_id, comentarios_solicitud, documentos_ids } = req.body;

    if (!revisor_id) {
      return res.status(400).json({ error: "Debes seleccionar a un revisor." });
    }

    // 1. INICIAMOS LA TRANSACCIÓN
    await client.query("BEGIN");

    // 2. OBTENER EL ID INTERNO DEL CASO
    // Buscamos el caso_id (entero) porque todas nuestras tablas dependientes lo necesitan
    const casoQuery = await client.query(
      "SELECT caso_id FROM casos WHERE expediente_id = $1",
      [parametroId],
    );
    if (casoQuery.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "El caso especificado no existe." });
    }
    const casoId = casoQuery.rows[0].caso_id;

    // 3. CREAR LA SOLICITUD DE REVISIÓN (Adaptado a la nueva tabla)
    // Enviamos explícitamente el estado 1 (Pendiente) a 'estado_revision_id'
    const insertQuery = `
            INSERT INTO revisiones_caso 
            (caso_id, solicitante_id, revisor_id, comentarios_solicitud, estado_revision_id, fecha_envio, activo) 
            VALUES ($1, $2, $3, $4, 1, $5, true) 
            RETURNING id;
        `;

    const fechaEnvio = new Date(); // Fecha actual para el campo 'fecha_envio'
    const nuevaRevision = await client.query(insertQuery, [
      casoId,
      solicitanteId,
      revisor_id,
      comentarios_solicitud,
      fechaEnvio,
    ]);
    const revisionId = nuevaRevision.rows[0].id;

    // hacemos el insert a la tabla de casos para marcar el estado_revision_id = 4 ("En Revisión") para que el caso se muestre como "En Revisión" en la lista de casos
    await client.query(
      `
            UPDATE casos 
            SET estado_revision_id = 1 
            WHERE caso_id = $1
        `,
      [casoId],
    );

    // 4. MARCAR LOS DOCUMENTOS COMO "EN REVISIÓN"
    let cantidadDocumentos = 0;
    if (
      documentos_ids &&
      Array.isArray(documentos_ids) &&
      documentos_ids.length > 0
    ) {
      await client.query(
        `
                UPDATE documentos 
                SET solicitud_revision = true 
                WHERE id = ANY($1) AND caso_id = $2
            `,
        [documentos_ids, casoId],
      );

      cantidadDocumentos = documentos_ids.length;
    }

    // 5. CONFIRMAMOS LA TRANSACCIÓN
    await client.query("COMMIT");

    // 6. REGISTRAR EN EL HISTORIAL (Fuera de la transacción)
    const revisorData = await pool.query(
      "SELECT nombre_completo FROM usuarios WHERE id = $1",
      [revisor_id],
    );
    const nombreRevisor =
      revisorData.rows.length > 0
        ? revisorData.rows[0].nombre_completo
        : "Colega";

    const mensajeHistorial =
      cantidadDocumentos > 0
        ? `Se enviaron ${cantidadDocumentos} documento(s) a revisión por ${nombreRevisor}. Comentarios: ${comentarios_solicitud}`
        : `Se solicitó una revisión general del caso a ${nombreRevisor}. Comentarios: ${comentarios_solicitud}`;

    await registrarHistorial(
      casoId,
      solicitanteId,
      "solicitud_revision",
      "Solicitud de Revisión Enviada",
      mensajeHistorial,
    );

    res.status(201).json({
      message: "Solicitud enviada a revisión exitosamente",
      revision_id: revisionId,
      estado_asignado: "Pendiente", // Confirmamos al frontend el estado inicial
    });
  } catch (error) {
    // SI ALGO FALLA, DESHACEMOS TODO PARA EVITAR BASURA EN LA BD
    await client.query("ROLLBACK");
    console.error("Error al enviar a revisión:", error);
    res
      .status(500)
      .json({ error: "Error al procesar la solicitud de revisión." });
  } finally {
    // SIEMPRE debemos devolver el cliente a la base de datos
    client.release();
  }
});

// ==========================================
// CANCELAR SOLICITUD DE REVISIÓN (PATCH)
// ==========================================
// Ejemplo: PATCH /api/casos/revisiones/5/cancelar
router.patch(
  "/revisiones/:id_revision/cancelar",
  verifyToken,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const revisionId = req.params.id_revision;
      const usuarioId = req.user.userId;

      await client.query("BEGIN");

      // 1. VERIFICAR QUE LA REVISIÓN EXISTA Y ESTÉ EN ESTADO 1 (Pendiente)
      const revisionQuery = await client.query(
        "SELECT caso_id, estado_revision_id, solicitante_id FROM revisiones_caso WHERE id = $1 AND activo = true",
        [revisionId],
      );

      if (revisionQuery.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "La solicitud de revisión no existe o ya fue cancelada.",
        });
      }

      const revisionActual = revisionQuery.rows[0];

      // Validar que solo el creador de la solicitud (o un admin) pueda cancelarla
      if (revisionActual.solicitante_id !== usuarioId) {
        await client.query("ROLLBACK");
        return res
          .status(403)
          .json({ error: "No tienes permiso para cancelar esta solicitud." });
      }

      // Validar la regla de negocio: Solo cancelar si es Estado 1 (Pendiente)
      if (revisionActual.estado_revision_id !== 1) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error:
            "No se puede cancelar esta solicitud porque ya está en proceso o finalizada.",
        });
      }

      const casoId = revisionActual.caso_id;

      // 2. DESACTIVAR LA SOLICITUD DE REVISIÓN (Borrado lógico)
      await client.query(
        "UPDATE revisiones_caso SET activo = false WHERE id = $1",
        [revisionId],
      );

      // 3. LIMPIAR EL ESTADO EN LA TABLA DE CASOS (Dejarlo en NULL o su estado por defecto)
      await client.query(
        "UPDATE casos SET estado_revision_id = 6 WHERE caso_id = $1",
        [casoId],
      );

      // 4. LIMPIAR LA MARCA EN LOS DOCUMENTOS DE ESTE CASO
      await client.query(
        "UPDATE documentos SET solicitud_revision = false WHERE caso_id = $1 AND solicitud_revision = true",
        [casoId],
      );

      // 5. CONFIRMAR LA TRANSACCIÓN
      await client.query("COMMIT");

      // 6. REGISTRAR EN EL HISTORIAL DE AUDITORÍA
      await registrarHistorial(
        casoId,
        usuarioId,
        "cancelacion_revision", // Asegúrate de tener este código en tu catálogo
        "Solicitud de Revisión Cancelada",
        "El usuario ha cancelado la solicitud de revisión antes de que fuera atendida.",
      );

      res.json({
        message: "La solicitud de revisión ha sido cancelada exitosamente.",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error al cancelar la revisión:", error);
      res
        .status(500)
        .json({ error: "Error interno al intentar cancelar la revisión." });
    } finally {
      client.release();
    }
  },
);

// ==========================================
// RUTA: INICIAR REVISIÓN (MARCAR COMO "EN REVISIÓN") (PATCH)
// ==========================================
// Ejemplo: PATCH /api/casos/revisiones/5/iniciar
router.patch("/revisiones/:id/iniciar", verifyToken, async (req, res) => {
  try {
    const revisionId = req.params.id;
    const revisorActual = req.user.userId;
    console.log(
      `Usuario ${revisorActual} intenta iniciar la revisión con ID ${revisionId}`,
    );
    // 1. ACTUALIZAR EL ESTADO A 4 ("En Revisión")
    // NOTA DE SEGURIDAD: Añadimos "estado_revision_id = 1" para asegurarnos
    // de que solo se pueda "iniciar" una revisión que estaba "Pendiente".
    const updateQuery = `
            UPDATE revisiones_caso 
            SET estado_revision_id = 4 
            WHERE id = $1 AND revisor_id = $2 AND estado_revision_id = 1
            RETURNING caso_id;
        `;

    const resultadoRevision = await pool.query(updateQuery, [
      revisionId,
      revisorActual,
    ]);

    await pool.query(
      `UPDATE casos 
            SET estado_revision_id = 4 
            WHERE caso_id = $1
        `,
      [resultadoRevision.rows[0]?.caso_id],
    );

    console.log(resultadoRevision.rows);
    // Si no devuelve nada, es porque no es su revisión, no existe, o ya había sido iniciada/respondida
    if (resultadoRevision.rows.length === 0) {
      return res.status(403).json({
        error:
          "No se pudo iniciar la revisión. Verifica que seas el encargado y que la solicitud siga Pendiente.",
      });
    }

    const casoId = resultadoRevision.rows[0].caso_id;

    // 2. REGISTRAR EN EL HISTORIAL DE AUDITORÍA
    // Usamos el código 'cambio_estado' de tu catálogo
    await registrarHistorial(
      casoId,
      revisorActual,
      "cambio_estado",
      "Revisión en Progreso",
      "El encargado ha comenzado a revisar los documentos.",
    );

    const expedienteQuery = await pool.query(
      "SELECT expediente_id FROM casos WHERE caso_id = $1",
      [casoId],
    );

    res.json({
      message: 'El caso ha sido marcado como "En Revisión".',
      estado_id: 4,
      expediente_id: expedienteQuery.rows[0].expediente_id,
    });
  } catch (error) {
    console.error("Error al iniciar la revisión:", error);
    res
      .status(500)
      .json({ error: "Error interno al actualizar el estado de la revisión." });
  }
});

// ==========================================
// RUTA: RESPONDER A UNA SOLICITUD DE REVISIÓN (PUT)
// ==========================================
// Ejemplo: PUT /api/casos/revisiones/5 (donde 5 es el ID de la revisión, no del caso)
router.put("/revisiones/:id_revision", verifyToken, async (req, res) => {
  const client = await pool.connect();
  console.log(
    `Usuario ${req.user.userId} intenta responder la revisión con ID ${req.params.id_revision}`,
  );
  try {
    const revisionId = req.params.id_revision;
    const revisorActual = req.user.userId;
    const { estado_revision_id, comentarios_revisor } = req.body;

    console.log(
      revisionId,
      revisorActual,
      estado_revision_id,
      comentarios_revisor,
    );

    // 1. Validamos que el estado exista (2, 3 o 5)
    if (![2, 3, 5].includes(estado_revision_id)) {
      return res.status(400).json({
        error: "Debes enviar un estado_revision_id válido (2, 3 o 5).",
      });
    }

    await client.query("BEGIN"); // Iniciamos transacción de seguridad

    // 2. ACTUALIZAR LA REVISIÓN (Solo si el usuario actual es el revisor asignado)
    const updateQuery = `
            UPDATE revisiones_caso 
            SET 
                estado_revision_id = $1, 
                comentarios_revisor = $2, 
                fecha_revision = CURRENT_TIMESTAMP,
                activo = false 
            WHERE id = $3 AND revisor_id = $4
            RETURNING caso_id;
        `;

    const resultadoRevision = await client.query(updateQuery, [
      estado_revision_id,
      comentarios_revisor,
      revisionId,
      revisorActual,
    ]);

    if (resultadoRevision.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "No tienes permiso para responder esta revisión o no existe.",
      });
    }

    const casoId = resultadoRevision.rows[0].caso_id;

    // 3. MAGIA: LIBERAR DOCUMENTOS
    // Si el estado es 2 (Aprobado) o 3 (Con Observaciones), la revisión terminó.
    // Por lo tanto, quitamos la marca de "solicitud_revision" de los documentos de este caso.
    if (estado_revision_id === 2 || estado_revision_id === 3) {
      await client.query(
        `
                UPDATE documentos 
                SET solicitud_revision = false 
                WHERE caso_id = $1 AND solicitud_revision = true
            `,
        [casoId],
      );
    }

    //cambiamos el estado del caso a Aprobado (2) o Con Observaciones (3) con estado_revision_id
    await client.query(
      `
            UPDATE casos 
            SET estado_revision_id = $1 
            WHERE caso_id = $2
        `,
      [estado_revision_id, casoId],
    );

    await client.query("COMMIT"); // Guardamos los cambios en la BD

    // 4. PREPARAR EL HISTORIAL DE AUDITORÍA
    // Obtenemos el texto del estado para que el historial sea legible
    const nombresEstados = {
      2: "Aprobado",
      3: "Con Observaciones",
      5: "Revisado",
    };
    const nombreEstadoTexto = nombresEstados[estado_revision_id];

    await registrarHistorial(
      casoId,
      revisorActual,
      "revision_completada",
      `Revisión ${nombreEstadoTexto}`,
      `El revisor contestó: "${comentarios_revisor || "Sin comentarios."}"`,
    );

    res.json({
      message: `La revisión ha sido marcada como: ${nombreEstadoTexto}`,
      estado_id: estado_revision_id,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al responder revisión:", error);
    res
      .status(500)
      .json({ error: "Error interno al procesar la respuesta de la revisión" });
  } finally {
    client.release();
  }
});

// ==========================================
// RUTA: MODIFICACION DE UN CASO (PUT /casos/:id)
// ==========================================
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const casoId = req.params.id;
    const {
      area_legal_id,
      cliente_id,
      responsable_id,
      descripcion_corta,
      descripcion_completa,
      contraparte,
    } = req.body;

    await pool.query(
      `UPDATE casos 
       SET area_legal_id = $1, cliente_id = $2, responsable_id = $3, descripcion_corta = $4, descripcion_completa = $5, contraparte = $6
       WHERE expediente_id = $7`,
      [
        area_legal_id,
        cliente_id,
        responsable_id,
        descripcion_corta,
        descripcion_completa,
        contraparte,
        casoId,
      ],
    );

    // 6. Enviamos respuesta de éxito
    res.json({
      message: "Caso actualizado exitosamente",
    });
  } catch (error) {
    console.error("Error al actualizar caso:", error);
    res
      .status(500)
      .json({ error: "Error interno al intentar actualizar el caso" });
  }
});

// ==========================================
// RUTA: TRAER LOS DETALLES DE UN CASO (GET /casos/:id)
// ==========================================

router.get("/:id", verifyToken, async (req, res) => {
  try {
    const casoId = req.params.id;
    // 1. Verificar si el usuario es el responsable del caso o es administrador
    const caso = await pool.query(
      `SELECT 
	    ca.nombre AS categoria_cliente,
	    c.expediente_id,
	    e.nombre AS estado,
      erev.descripcion AS estado_revision,
	    c.descripcion_corta AS titulo,
	    cli.nombre_completo AS nombre_cliente,
	    c.descripcion_completa AS descripcion,
	    to_char(c.creado_en, 'YYYY-MM-DD') AS fecha_inicio,
	    c.contraparte
    FROM casos c 
	    JOIN clientes cli ON cli.id = c.cliente_id
	    JOIN estados_caso e ON e.id = c.estado_id 
	    JOIN categorias_cliente ca ON ca.id = cli.categoria_id
      JOIN estado_revision erev ON erev.id = c.estado_revision_id
    WHERE expediente_id = $1`,
      [casoId],
    );

    if (caso.rows.length === 0) {
      return res.status(404).json({ error: "Caso no encontrado" });
    }

    // 2. Devolver los datos del caso
    res.json({ caso: caso.rows[0] });
  } catch (error) {
    console.error("Error al obtener el caso:", error);
    res
      .status(500)
      .json({ error: "Error interno al intentar obtener el caso" });
  }
});

// ==========================================
// RUTA: TRAER LOS DATOS PARA EL FORMULARIO DE EDICIÓN DE UN CASO (GET /casos/formData/:id)
// ==========================================

router.get("/formData/:id", verifyToken, async (req, res) => {
  try {
    const casoId = req.params.id;

    // 1. Verificar si el usuario es el responsable del caso o es administrador
    const caso = await pool.query(
      `SELECT 
		    cliente_id,
		    area_legal_id,
		    responsable_id
      FROM casos 
      WHERE expediente_id =  $1`,
      [casoId],
    );

    if (caso.rows.length === 0) {
      return res.status(404).json({ error: "Caso no encontrado" });
    }

    // 2. Devolver los datos del caso
    res.json({ caso: caso.rows[0] });
  } catch (error) {
    console.error("Error al obtener el caso:", error);
    res
      .status(500)
      .json({ error: "Error interno al intentar obtener el caso" });
  }
});

//---------------- CONTACTOS DE UN CASO-----------------------------
// GET /api/casos/:expediente_id/contactos-asignados
// trae los contactos asignados a un caso.
router.get(
  "/:expediente_id/contactos-asignados",
  verifyToken,
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { expediente_id } = req.params;

      const query = `
            SELECT cc.caso_id AS vinculacion_id, con.* FROM casos c
            JOIN contactos_caso cc ON c.caso_id = cc.caso_id
            JOIN contactos_cliente con ON cc.contacto_id = con.id
            WHERE c.expediente_id = $1
        `;

      const result = await client.query(query, [expediente_id]);
      res.status(200).json(result.rows);
    } catch (error) {
      console.error("Error al obtener contactos asignados al caso:", error);
      res.status(500).json({
        error: "Hubo un problema al cargar los contactos del expediente.",
      });
    } finally {
      client.release();
    }
  },
);

// GET /api/casos/:expediente_id/contactos-disponibles
router.get(
  "/:expediente_id/contactos-disponibles",
  verifyToken,
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { expediente_id } = req.params;

      // Buscamos los contactos del cliente al que pertenece este caso
      const query = `
            SELECT con.* FROM casos c
            JOIN contactos_cliente con ON c.cliente_id = con.cliente_id
            WHERE c.expediente_id = $1
        `;

      const result = await client.query(query, [expediente_id]);
      res.status(200).json(result.rows);
    } catch (error) {
      console.error(
        "Error al obtener contactos disponibles del cliente:",
        error,
      );
      res.status(500).json({
        error: "Hubo un problema al cargar los contactos disponibles.",
      });
    } finally {
      client.release();
    }
  },
);

// POST /api/casos/:expediente_id/contactos
router.post("/:expediente_id/contactos", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { expediente_id } = req.params;
    const { contactos_ids } = req.body; // Se espera un array: [1, 4, 7]

    if (!Array.isArray(contactos_ids) || contactos_ids.length === 0) {
      return res
        .status(400)
        .json({ error: "Debe proporcionar al menos un ID de contacto." });
    }

    await client.query("BEGIN"); // Iniciamos la transacción segura

    // 1. Obtener el ID numérico interno del caso
    const casoRes = await client.query(
      "SELECT caso_id FROM casos WHERE expediente_id = $1",
      [expediente_id],
    );

    if (casoRes.rows.length === 0) {
      throw new Error("No se encontró el caso especificado.");
    }

    const caso_id = casoRes.rows[0].caso_id;

    // 2. Insertar cada contacto verificando que no exista un duplicado
    for (let contacto_id of contactos_ids) {
      // Verificamos si ya está asignado para no romper la base de datos (por si el usuario hace doble clic)
      const checkRes = await client.query(
        "SELECT id FROM contactos_caso WHERE caso_id = $1 AND contacto_id = $2",
        [caso_id, contacto_id],
      );

      // Si no existe, lo insertamos
      if (checkRes.rows.length === 0) {
        await client.query(
          "INSERT INTO contactos_caso (caso_id, contacto_id) VALUES ($1, $2)",
          [caso_id, contacto_id],
        );
      }
    }

    await client.query("COMMIT"); // Guardamos los cambios
    res
      .status(201)
      .json({ message: "Contactos vinculados al caso exitosamente." });
  } catch (error) {
    await client.query("ROLLBACK"); // Si algo falla, deshacemos todo
    console.error("Error al vincular contactos al caso:", error);
    res.status(500).json({
      error: error.message || "Error interno al asignar los contactos.",
    });
  } finally {
    client.release();
  }
});

// =========================================================
// QUITAR UN CONTACTO / MIEMBRO DE UN CASO (DELETE)
// =========================================================
// Ejemplo: DELETE /api/casos/15/contactos/3
router.delete(
  "/:caso_id/contactos/:contacto_id",
  verifyToken,
  async (req, res) => {
    try {
      const { caso_id, contacto_id } = req.params;
      const casoId = caso_id.split("-").pop();

      // Borrado físico solo de la RELACIÓN (El contacto sigue vivo en el sistema)
      const deleteQuery = `
            DELETE FROM contactos_caso 
            WHERE caso_id = $1 AND contacto_id = $2 
            RETURNING *;
        `;

      const resultado = await pool.query(deleteQuery, [+casoId, contacto_id]);

      // Si no devolvió nada, significa que ese contacto no estaba en ese caso
      if (resultado.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "El contacto no estaba vinculado a este caso." });
      }

      // Opcional: Registrar en el historial del caso que se removió a esta persona
      // await registrarHistorial(caso_id, req.user.userId, 'remocion_contacto', 'Contacto removido', `Se desvinculó al contacto ID ${contacto_id} del caso.`);

      res.json({ message: "Contacto desvinculado del caso exitosamente." });
    } catch (error) {
      console.error("Error al remover el contacto del caso:", error);
      res
        .status(500)
        .json({ error: "Error interno al intentar desvincular el contacto." });
    }
  },
);

module.exports = router;
