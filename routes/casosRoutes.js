const express = require("express");
const router = express.Router();
const pool = require("../db");
const verifyToken = require("../middlewares/verifyToken");

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
                e.nombre AS estado_nombre
            FROM casos c
            LEFT JOIN clientes cli ON c.cliente_id = cli.id
            JOIN usuarios u ON c.responsable_id = u.id
            JOIN estados_caso e ON c.estado_id = e.id
            JOIN area_legal a ON c.area_legal_id = a.id
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
          "Los campos area_legal, cliente_id, descripcion_corta, descripcion_completa, responsable_id y fecha_inicio son obligatorios.",
      });
    }

    const estado_id = 1; // Por defecto, el caso se crea como "Activo"
    const sub_estado = "Activo"; // Sub-estado inicial
    const creado_en = new Date(); // Fecha actual

    // 5. Guardar el caso en PostgreSQL
    const insertQuery = `
            INSERT INTO casos 
            (area_legal_id, expediente_id, cliente_id, responsable_id, descripcion_corta, descripcion_completa, contraparte, fecha_inicio, fecha_cierre, estado_id, sub_estado, creado_en) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
            RETURNING caso_id; -- RETURNING * nos devuelve toda la fila recién creada
        `;

    const valores = [
      area_legal_id,
      "TEMP",
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

    const nuevoCaso = await pool.query(insertQuery, valores);

    //hacemos un update para asignar el expediente_id con el formato "EXP-2026-0001"
    const expedienteId = `EXP-${new Date().getFullYear()}-${String(nuevoCaso.rows[0].caso_id).padStart(4, "0")}`;
    const updateQuery = `
            UPDATE casos 
            SET expediente_id = $1 
            WHERE caso_id = $2;`;
    await pool.query(updateQuery, [expedienteId, nuevoCaso.rows[0].caso_id]);

    const casoCreado = await pool.query(
      `SELECT * FROM casos WHERE caso_id = $1`,
      [nuevoCaso.rows[0].caso_id],
    );

    // 6. Enviamos respuesta de éxito
    res.status(201).json({
      message: "Caso creado exitosamente",
      caso: casoCreado.rows[0], // Mandamos los datos del caso para que el Frontend los muestre de inmediato
    });
  } catch (error) {
    console.error("Error al crear caso:", error);
    res
      .status(500)
      .json({ error: "Error interno al intentar crear el nuevo caso" });
  }
});

// ==========================================
// RUTA DE EQUIPO LEGAL DEL CASO (GET /casos/equipo)
// ==========================================
router.get("/equipo", verifyToken, async (req, res) => {
  try {
    
    const {expediente_id} = req.query; 
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
    const nuevoMiembro = await pool.query(insertQuery, [expediente_id, usuario_id]);
    res.status(201).json({
      message: "Miembro agregado al equipo legal del caso",
    });
  } catch (error) {
    console.error("Error al agregar miembro al equipo del caso:", error);
    res
      .status(500)
      .json({ error: "Error interno al intentar agregar miembro al equipo del caso" });
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
    res
      .status(500)
      .json({ error: "Error interno al intentar eliminar miembro del equipo del caso" });
  }
});

// ==========================================
// RUTA: OBTENER HISTORIAL DE UN CASO (GET)
// ==========================================
router.get('/:id/historial', verifyToken, async (req, res) => {
    try {
        const casoId = req.params.id;

        // 1. Buscamos el ID numérico interno del caso (si envían el expediente_id como CIV-2024-001)
        const casoData = await pool.query(`SELECT caso_id FROM casos WHERE expediente_id = $1`, [casoId]);
        if (casoData.rows.length === 0) {
            return res.status(404).json({ error: 'Caso no encontrado' });
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
                    eventos: []
                };
            }
            
            // Metemos el evento dentro del grupo de su fecha
            acumulador[fecha].eventos.push({
                id: evento.id,
                tipo: evento.tipo,
                titulo: evento.titulo,
                descripcion: evento.descripcion,
                hora: evento.hora,
                autor: evento.autor_nombre || 'Sistema', // Si es null, decimos que fue el Sistema
                avatar: evento.autor_avatar
            });
            
            return acumulador;
        }, {});

        // 4. Convertimos el objeto agrupado en un Array ordenado para que React lo lea fácilmente con un .map()
        const resultadoFinal = Object.values(historialAgrupado);

        res.json({
            total_eventos: historialDB.rows.length,
            historial: resultadoFinal
        });

    } catch (error) {
        console.error('Error al obtener el historial:', error);
        res.status(500).json({ error: 'Error interno al cargar la bitácora del caso.' });
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
	    c.descripcion_corta AS titulo,
	    cli.nombre_completo AS nombre_cliente,
	    c.descripcion_completa AS descripcion,
	    to_char(c.creado_en, 'YYYY-MM-DD') AS fecha_inicio,
	    c.contraparte
    FROM casos c 
	    JOIN clientes cli ON cli.id = c.cliente_id
	    JOIN estados_caso e ON e.id = c.estado_id 
	    JOIN categorias_cliente ca ON ca.id = cli.categoria_id
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

module.exports = router;
