const express = require("express");
const router = express.Router();
const pool = require("../db");
const verifyToken = require("../middlewares/verifyToken");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const os = require("os"); // Para usar la carpeta temporal del sistema

// Usamos variables de entorno o un fallback
const RUTA_DESTINO_BASE = process.env.RUTA_DESTINO_BASE;
const RUTA_DOCS_SUELTOS = path.join(RUTA_DESTINO_BASE, "/docSueltos");

// Asegurar que la carpeta maestra "docSueltos" exista al iniciar
if (!fs.existsSync(RUTA_DOCS_SUELTOS)) {
  fs.mkdirSync(RUTA_DOCS_SUELTOS, { recursive: true });
}

// ==========================================
// CONFIGURACIÓN DE MULTER PARA DOC SUELTOS
// ==========================================
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      // 1. Obtenemos el ID de la carpeta desde la URL
      const carpetaId = req.params.carpeta_id;

      // 2. Buscamos la ruta física exacta en la base de datos
      const result = await pool.query(
        "SELECT ruta FROM carpetas WHERE id = $1",
        [carpetaId],
      );

      if (result.rows.length === 0) {
        // Si alguien manda un ID falso, detenemos la subida
        return cb(new Error("CARPETA_NO_ENCONTRADA"));
      }

      const rutaDestino = result.rows[0].ruta;

      // 3. Verificamos que la carpeta exista físicamente por precaución
      if (!fs.existsSync(rutaDestino)) {
        fs.mkdirSync(rutaDestino, { recursive: true });
      }

      // 4. Multer guarda el archivo directamente en el Disco D:
      cb(null, rutaDestino);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    // Usamos el nombre original. El ID se lo agregaremos después en la ruta.
    cb(null, file.originalname);
  },
});

// Filtro opcional para evitar duplicados exactos en la misma carpeta
const fileFilter = async (req, file, cb) => {
  try {
    const carpetaId = req.params.carpeta_id;
    const result = await pool.query("SELECT ruta FROM carpetas WHERE id = $1", [
      carpetaId,
    ]);
    if (result.rows.length > 0) {
      const rutaCompleta = path.join(result.rows[0].ruta, file.originalname);
      if (fs.existsSync(rutaCompleta)) {
        return cb(new Error("ARCHIVO_DUPLICADO"), false);
      }
    }
    cb(null, true);
  } catch (error) {
    cb(error);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// ==========================================
// 1. RUTAS DE CARPETAS
// ==========================================

// GET: Listar todas las carpetas
router.get("/carpetas", verifyToken, async (req, res) => {
  try {
    const carpetas = await pool.query(
      "SELECT * FROM carpetas ORDER BY nombre_carpeta ASC",
    );
    res.json(carpetas.rows);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener las carpetas." });
  }
});

// POST: Crear nueva carpeta
router.post("/carpetas", verifyToken, async (req, res) => {
  try {
    const { nombre_carpeta } = req.body;

    if (!nombre_carpeta)
      return res.status(400).json({ error: "El nombre es obligatorio." });

    const rutaFisica = path.join(RUTA_DOCS_SUELTOS, nombre_carpeta);

    // 1. Crear en el disco duro si no existe
    if (fs.existsSync(rutaFisica)) {
      return res
        .status(400)
        .json({ error: "Ya existe una carpeta con ese nombre físicamente." });
    }
    fs.mkdirSync(rutaFisica);

    // 2. Crear en la base de datos
    const insertQuery = `INSERT INTO carpetas (nombre_carpeta, ruta) VALUES ($1, $2) RETURNING *`;
    const nuevaCarpeta = await pool.query(insertQuery, [
      nombre_carpeta,
      rutaFisica,
    ]);

    res
      .status(201)
      .json({ message: "Carpeta creada", carpeta: nuevaCarpeta.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      // Código de error de Postgres para UNIQUE
      return res
        .status(400)
        .json({ error: "Ese nombre de carpeta ya está registrado." });
    }
    res.status(500).json({ error: "Error interno al crear la carpeta." });
  }
});

// DELETE: Eliminar carpeta (Solo si está vacía)
router.delete("/carpetas/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const carpetaDB = await pool.query(
      "SELECT ruta FROM carpetas WHERE id = $1",
      [id],
    );
    if (carpetaDB.rows.length === 0)
      return res.status(404).json({ error: "Carpeta no encontrada." });

    const rutaFisica = carpetaDB.rows[0].ruta;

    // 1. Verificar si hay archivos en la base de datos
    const docsAsociados = await pool.query(
      "SELECT id FROM doc_carpetas WHERE carpeta_id = $1 AND estado_doc = true",
      [id],
    );
    if (docsAsociados.rows.length > 0) {
      return res.status(400).json({
        error: "No puedes borrar una carpeta que contiene documentos.",
      });
    }

    // 2. Verificar y borrar en el disco duro (rmdirSync falla por defecto si no está vacía)
    if (fs.existsSync(rutaFisica)) {
      try {
        fs.rmdirSync(rutaFisica);
      } catch (err) {
        return res.status(400).json({
          error: "La carpeta física contiene archivos no registrados.",
        });
      }
    }

    // 3. Borrar de la base de datos
    await pool.query("DELETE FROM carpetas WHERE id = $1", [id]);
    res.json({ message: "Carpeta eliminada exitosamente." });
  } catch (error) {
    res.status(500).json({ error: "Error interno al eliminar la carpeta." });
  }
});

// PUT: Renombrar carpeta (Nivel Senior: Actualiza archivos y rutas)
router.put("/carpetas/:id", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    console.log("Iniciando proceso de renombrado de carpeta...");
    const { id } = req.params;
    const { nuevo_nombre } = req.body;

    await client.query("BEGIN");

    const carpetaAnterior = await client.query(
      "SELECT * FROM carpetas WHERE id = $1",
      [id],
    );
    if (carpetaAnterior.rows.length === 0) throw new Error("NOT_FOUND");

    const rutaVieja = carpetaAnterior.rows[0].ruta;
    const rutaNueva = path.join(RUTA_DOCS_SUELTOS, nuevo_nombre);

    if (fs.existsSync(rutaNueva)) {
      return res
        .status(400)
        .json({ error: "Ya existe una carpeta física con ese nuevo nombre." });
    }

    // 1. Renombrar en disco duro
    if (fs.existsSync(rutaVieja)) {
      fs.renameSync(rutaVieja, rutaNueva);
    }

    // 2. Actualizar la tabla de carpetas
    const carpetaActualizada = await client.query(
      "UPDATE carpetas SET nombre_carpeta = $1, ruta = $2 WHERE id = $3 RETURNING *",
      [nuevo_nombre, rutaNueva, id],
    );

    // 3. Actualizar TODAS las rutas de los documentos adentro (MAGIA SQL)
    // Usamos la función REPLACE() de Postgres para cambiar el pedazo viejo de la ruta por el nuevo
    await client.query(
      `
            UPDATE doc_carpetas 
            SET ruta_archivo = REPLACE(ruta_archivo, $1, $2)
            WHERE carpeta_id = $3
        `,
      [rutaVieja, rutaNueva, id],
    );

    await client.query("COMMIT");
    res.json({
      message: "Carpeta renombrada",
      carpeta: carpetaActualizada.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.message === "NOT_FOUND")
      return res.status(404).json({ error: "Carpeta no existe." });
    if (error.code === "23505")
      return res.status(400).json({ error: "El nombre ya existe." });

    console.error(error);
    res
      .status(500)
      .json({ error: "Error al renombrar la carpeta y sus archivos." });
  } finally {
    client.release();
  }
});

// ==========================================
// 2. RUTAS DE DOCUMENTOS SUELTOS
// ==========================================

// traer los docuemntos de una carpeta
router.get("/carpetas/:id_carpeta", verifyToken, async (req, res) => {
  try {
    const { id_carpeta } = req.params;
    const userId = req.user.userId;

    const nombre_carpeta = await pool.query(
      `
      SELECT nombre_carpeta FROM carpetas where id = $1
      `,
      [id_carpeta],
    );

    const documentos = await pool.query(
      `
      SELECT * FROM carpetas c 
        JOIN doc_carpetas dc ON dc.carpeta_id = c.id
        JOIN equipo_documentos e ON e.documento_id = dc.id
        WHERE e.usuario_id = $1 AND c.id = $2 AND dc.estado_doc = true
        `,
      [userId, id_carpeta],
    );

    res.json({
      nombre_carpeta: nombre_carpeta.rows[0].nombre_carpeta,
      documentos: documentos.rows,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Error al traer los documentos de la carpeta." });
  }
});

// ==========================================
// A. SUBIR DOCUMENTO A UNA CARPETA (POST)
// ==========================================
router.post("/carpetas/:carpeta_id/documentos", verifyToken, (req, res) => {
  upload.single("archivo")(req, res, async function (err) {
    // Manejo de errores de Multer
    if (err) {
      if (err.message === "ARCHIVO_DUPLICADO") {
        return res
          .status(400)
          .json({ error: "El archivo ya existe en esta carpeta." });
      }
      if (err.message === "CARPETA_NO_ENCONTRADA") {
        return res
          .status(404)
          .json({ error: "La carpeta destino no existe en la base de datos." });
      }
      console.error("Error de Multer:", err);
      return res
        .status(500)
        .json({ error: "Error interno al subir el archivo." });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No se seleccionó ningún archivo para subir." });
    }

    try {
      const carpetaId = req.params.carpeta_id;
      const usuario_id = req.user.userId;
      const nombreOriginal = req.file.filename;

      // 1. SOLICITAMOS UNA CONEXIÓN EXCLUSIVA PARA LA TRANSACCIÓN
      const client = await pool.connect();

      try {
        await client.query("BEGIN"); // Iniciamos la transacción segura

        // 2. HACEMOS EL INSERT PARA OBTENER EL ID
        const insertQuery = `
            INSERT INTO doc_carpetas 
            (carpeta_id, nombre, ruta_archivo, subido_por_id, peso_mb, fecha_modificacion) 
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            RETURNING id;
        `;

        const nuevaDocumentacion = await client.query(insertQuery, [
          carpetaId,
          nombreOriginal,
          req.file.path, // Ruta temporal
          usuario_id,
          Math.trunc(req.file.size / (1024 * 1024)),
        ]);

        const nuevoId = nuevaDocumentacion.rows[0].id;

        // 3. INSERTAMOS AL EQUIPO (En la misma transacción, así Postgres SÍ ve el nuevoId)
        // Nota: Agregué explícitamente (documento_id, usuario_id) al ON CONFLICT, es una mejor práctica en SQL
        await client.query(
          `
          INSERT INTO equipo_documentos (documento_id, usuario_id) 
          VALUES ($1, $2) ON CONFLICT (documento_id, usuario_id) DO NOTHING
        `,
          [nuevoId, usuario_id],
        );

        // 4. RENOMBRAMOS EL ARCHIVO FÍSICO
        const nombreConId = `${nuevoId}_${nombreOriginal}`;
        const carpetaDinamica = path.dirname(req.file.path);
        const rutaFisicaNueva = path.join(carpetaDinamica, nombreConId);

        fs.renameSync(req.file.path, rutaFisicaNueva);

        // 5. ACTUALIZAMOS LA BASE DE DATOS CON LA RUTA Y NOMBRE FINALES
        const updateQuery = `
            UPDATE doc_carpetas 
            SET nombre = $1, ruta_archivo = $2 
            WHERE id = $3 
            RETURNING *;
        `;

        const documentoFinal = await client.query(updateQuery, [
          nombreConId,
          rutaFisicaNueva,
          nuevoId,
        ]);

        // 6. SI TODO SALIÓ BIEN, GUARDAMOS LOS CAMBIOS EN LA BD
        await client.query("COMMIT");

        res.status(201).json({
          message: "Documento subido y registrado exitosamente.",
          documento: documentoFinal.rows[0],
        });
      } catch (dbError) {
        // SI ALGO FALLA EN LA BASE DE DATOS O RENOMBRANDO EL ARCHIVO, DESHACEMOS TODO
        await client.query("ROLLBACK");
        throw dbError; // Mandamos el error al catch principal
      } finally {
        client.release(); // SIEMPRE devolvemos la conexión al pool
      }
    } catch (error) {
      console.error("Error al procesar el documento:", error);

      // Limpieza de emergencia del archivo físico si algo explotó
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        error: "Error interno al registrar el documento en el sistema.",
      });
    }
  });
});

// B. COMPARTIR DOCUMENTO CON USUARIOS (POST)
router.post("/documentos/:id/compartir", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { usuarios_ids } = req.body; // Array de IDs: [2, 3, 5]
    console.log("Usuarios a compartir:", usuarios_ids);
    if (
      !usuarios_ids ||
      !Array.isArray(usuarios_ids) ||
      usuarios_ids.length === 0
    ) {
      return res
        .status(400)
        .json({ error: "Debes enviar una lista de usuarios." });
    }

    // 1. VERIFICACIÓN CRÍTICA: ¿Existe el documento en doc_carpetas?
    const docCheck = await pool.query(
      "SELECT id FROM doc_carpetas WHERE id = $1",
      [id],
    );

    if (docCheck.rows.length === 0) {
      return res.status(404).json({
        error: `El documento suelto con ID ${id} no existe o ya fue eliminado.`,
      });
    }

    // 2. INSERTAR RELACIONES DE FORMA SEGURA
    // Le decimos a Postgres exactamente qué columnas verificar para el "DO NOTHING"
    for (const user_id of usuarios_ids) {
      await pool.query(
        `
        INSERT INTO equipo_documentos (documento_id, usuario_id) 
        VALUES ($1, $2) 
        ON CONFLICT (documento_id, usuario_id) DO NOTHING
      `,
        [id, user_id],
      );
    }

    res.json({
      message: `Documento compartido con ${usuarios_ids.length} usuario(s).`,
    });
  } catch (error) {
    console.error("Error al compartir el documento:", error);
    res
      .status(500)
      .json({ error: "Error interno al intentar compartir el documento." });
  }
});

// C. VINCULAR DOCUMENTO SUELTO A UN CASO LEGAL (POST)
router.post("/documentos/:id/vincular-caso", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const docSueltoId = req.params.id;
    const { caso_id, tipo_documento_id } = req.body;
    const usuarioId = req.user.userId;

    await client.query("BEGIN");

    // 1. Obtener info del documento suelto
    const docQuery = await client.query(
      "SELECT * FROM doc_carpetas WHERE id = $1",
      [docSueltoId],
    );
    if (docQuery.rows.length === 0) throw new Error("DOC_NOT_FOUND");
    const docSuelto = docQuery.rows[0];

    // 2. Obtener info del Caso para saber dónde copiar el archivo
    const casoQuery = await client.query(
      "SELECT expediente_id FROM casos WHERE caso_id = $1",
      [caso_id],
    );
    if (casoQuery.rows.length === 0) throw new Error("CASE_NOT_FOUND");
    const expediente_id = casoQuery.rows[0].expediente_id;

    // 3. Calcular la ruta del expediente (Como lo hicimos en documentosRoutes)
    const RUTA_DESTINO_BASE_CASOS = "D:/Cristhian Dev/AlaizaPedraza/Documentos"; // Asegúrate que esta es la correcta
    const anioActual = new Date().getFullYear().toString();
    const carpetaExpediente = path.join(
      RUTA_DESTINO_BASE_CASOS,
      anioActual,
      expediente_id,
    );

    if (!fs.existsSync(carpetaExpediente)) {
      fs.mkdirSync(carpetaExpediente, { recursive: true });
    }

    // 4. Copiar el archivo físicamente
    const rutaVieja = docSuelto.ruta_archivo;
    // Le quitamos el ID viejo (ej: "45_") para que entre limpio al caso
    const nombreLimpio = docSuelto.nombre.replace(/^\d+_/, "");
    const rutaTemporalCopia = path.join(carpetaExpediente, nombreLimpio);

    fs.copyFileSync(rutaVieja, rutaTemporalCopia); // COPY, no RENAME, para que no desaparezca de la carpeta original

    // 5. Insertar en la tabla oficial de `documentos` del caso
    const insertCasoDoc = await client.query(
      `
            INSERT INTO documentos (caso_id, subido_por_id, nombre, url_archivo, tipo_documento_id, pesoMB, fecha_modificacion)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING id
        `,
      [
        caso_id,
        usuarioId,
        nombreLimpio,
        rutaTemporalCopia,
        tipo_documento_id,
        docSuelto.peso_mb,
      ],
    );

    const nuevoDocCasoId = insertCasoDoc.rows[0].id;

    // 6. Renombrar la copia con su nuevo ID oficial del caso
    const nombreOficialCaso = `${nuevoDocCasoId}_${nombreLimpio}`;
    const rutaFinalCopia = path.join(carpetaExpediente, nombreOficialCaso);
    fs.renameSync(rutaTemporalCopia, rutaFinalCopia);

    // Actualizamos la ruta en la tabla `documentos`
    await client.query(
      "UPDATE documentos SET nombre = $1, url_archivo = $2 WHERE id = $3",
      [nombreOficialCaso, rutaFinalCopia, nuevoDocCasoId],
    );

    // 7. Actualizar el doc_carpetas original para marcar que ya pertenece a un caso
    await client.query("UPDATE doc_carpetas SET caso_id = $1 WHERE id = $2", [
      caso_id,
      docSueltoId,
    ]);

    await client.query("COMMIT");
    res.json({
      message: "Documento vinculado y copiado al expediente exitosamente.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.message === "DOC_NOT_FOUND")
      return res.status(404).json({ error: "Documento suelto no encontrado." });
    if (error.message === "CASE_NOT_FOUND")
      return res.status(404).json({ error: "El caso especificado no existe." });
    console.error(error);
    res.status(500).json({ error: "Error al vincular el documento al caso." });
  } finally {
    client.release();
  }
});

// D. ELIMINACIÓN LÓGICA DE DOCUMENTO SUELTO (DELETE)
router.delete("/documentos/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE doc_carpetas SET estado_doc = false WHERE id = $1 RETURNING id",
      [id],
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Documento no encontrado." });
    res.json({ message: "Documento eliminado de la carpeta." });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar el documento." });
  }
});

// ==========================================
// F. CREAR DOCUMENTO EN BLANCO (WORD, EXCEL, PPT) (POST)
// ==========================================
router.post(
  "/carpetas/:carpeta_id/documentos/blanco",
  verifyToken,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { carpeta_id } = req.params;
      const usuario_id = req.user.userId;
      const { nombreArchivo, tipoPlantilla } = req.body;

      if (!nombreArchivo || !tipoPlantilla) {
        return res.status(400).json({
          error:
            "El nombre del archivo y el tipo de plantilla son obligatorios.",
        });
      }

      await client.query("BEGIN"); // Iniciamos transacción

      // 1. BUSCAR LA CARPETA EN LA BASE DE DATOS
      const carpetaQuery = await client.query(
        "SELECT ruta FROM carpetas WHERE id = $1",
        [carpeta_id],
      );
      if (carpetaQuery.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "La carpeta destino no existe." });
      }
      const carpetaDinamica = carpetaQuery.rows[0].ruta;

      // 2. DEFINIR LA PLANTILLA ORIGEN
      let nombrePlantilla = "";
      if (tipoPlantilla === "word") nombrePlantilla = "blank.docx";
      else if (tipoPlantilla === "excel") nombrePlantilla = "blank.xlsx";
      else if (tipoPlantilla === "powerpoint") nombrePlantilla = "blank.pptx";
      else {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Tipo de plantilla no válido." });
      }

      // Asumiendo que tu carpeta "plantillas" está al nivel de la raíz del proyecto
      const templatePath = path.join(
        __dirname,
        "../plantillas",
        nombrePlantilla,
      );
      const extension = path.extname(nombrePlantilla);
      const nombreInicial = `${nombreArchivo}${extension}`;

      if (!fs.existsSync(templatePath)) {
        await client.query("ROLLBACK");
        return res
          .status(500)
          .json({ error: "El archivo de plantilla no existe en el servidor." });
      }

      // 3. PRIMER INSERT PARA OBTENER EL ID AUTOGENERADO
      const insertQuery = `
            INSERT INTO doc_carpetas 
            (carpeta_id, nombre, ruta_archivo, subido_por_id, peso_mb, fecha_modificacion) 
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            RETURNING id;
        `;
      const nuevaDocumentacion = await client.query(insertQuery, [
        carpeta_id,
        nombreInicial,
        "ruta_temporal", // Placeholder
        usuario_id,
        0, // Peso inicial de una plantilla vacía
      ]);

      const nuevoId = nuevaDocumentacion.rows[0].id;

      // 4. DAR PERMISO AL CREADOR (Insertar en equipo_documentos)
      await client.query(
        `
            INSERT INTO equipo_documentos (documento_id, usuario_id) 
            VALUES ($1, $2) ON CONFLICT (documento_id, usuario_id) DO NOTHING
        `,
        [nuevoId, usuario_id],
      );

      // 5. COPIAR EL ARCHIVO CON EL NOMBRE FINAL AL DISCO DURO (Disco D)
      // Asegurarnos de que la carpeta física realmente exista por si la borraron por error a mano
      if (!fs.existsSync(carpetaDinamica)) {
        fs.mkdirSync(carpetaDinamica, { recursive: true });
      }

      const nombreConId = `${nuevoId}_${nombreInicial}`;
      const rutaFisicaNueva = path.join(carpetaDinamica, nombreConId);

      // Copiamos la plantilla al destino final
      fs.copyFileSync(templatePath, rutaFisicaNueva);

      // 6. ACTUALIZAR LA BASE DE DATOS CON LA RUTA Y NOMBRE FINALES
      const updateQuery = `
            UPDATE doc_carpetas 
            SET nombre = $1, ruta_archivo = $2 
            WHERE id = $3 
            RETURNING *;
        `;
      const documentoFinal = await client.query(updateQuery, [
        nombreConId,
        rutaFisicaNueva,
        nuevoId,
      ]);

      // 7. CONFIRMAR TRANSACCIÓN
      await client.query("COMMIT");

      res.status(201).json({
        message: "Documento en blanco creado y registrado exitosamente.",
        documento: documentoFinal.rows[0], // El Frontend lo usará para extraer el ID y abrir el Editor
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error al generar la documentación en blanco:", error);
      res
        .status(500)
        .json({ error: "Error interno al generar el documento en blanco." });
    } finally {
      client.release();
    }
  },
);

// RUTA GET: Para descargar el documento enviando la ruta exacta
router.get("/descargar", (req, res) => {
  // Extraemos la ruta que enviamos desde React (?ruta=...)
  const rutaCompleta = req.query.ruta;

  if (!rutaCompleta) {
    return res
      .status(400)
      .json({ error: "No se proporcionó la ruta del archivo." });
  }
  // Comprobamos si el archivo realmente existe en el disco duro del servidor
  if (fs.existsSync(rutaCompleta)) {
    // res.sendFile agarra el archivo de esa ruta y lo dibuja en el navegador
    res.sendFile(rutaCompleta);
  } else {
    // Si el registro está en la BD pero alguien borró el PDF físicamente de la carpeta
    res
      .status(404)
      .send("El documento no existe físicamente en el servidor o fue movido.");
  }
});

// E. ENDPOINT WOPI PARA DOCUMENTOS SUELTOS
// 1. CheckFileInfo: Collabora pide los metadatos del documento
router.get("/files/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    // Buscamos el documento en la base de datos
    const docQuery = await pool.query(
      "SELECT nombre, ruta_archivo, subido_por_id FROM doc_carpetas WHERE id = $1",
      [fileId],
    );

    if (docQuery.rows.length === 0)
      return res.status(404).send("Archivo no encontrado");
    const doc = docQuery.rows[0];
    const filePath = path.resolve(doc.ruta_archivo); // Ruta física en el servidor
    const stats = fs.statSync(filePath);

    res.json({
      BaseFileName: doc.nombre,
      Size: stats.size,
      UserId: doc.subido_por_id.toString(), // ID del abogado que lo abre
      UserCanWrite: true, // Aquí puedes poner lógica: si el usuario es "Pasante", puedes poner false para que sea solo lectura
      PostMessageOrigin: "*", // Idealmente, el dominio de tu frontend
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error del servidor");
  }
});

// 2. GetFile: Collabora descarga los binarios para mostrarlo
router.get("/files/:fileId/contents", async (req, res) => {
  try {
    const { fileId } = req.params;
    const docQuery = await pool.query(
      "SELECT ruta_archivo FROM doc_carpetas WHERE id = $1",
      [fileId],
    );
    if (docQuery.rows.length === 0)
      return res.status(404).send("Archivo no encontrado");

    const filePath = path.resolve(docQuery.rows[0].url_archivo);
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).send("Error enviando archivo");
  }
});

// 3. PutFile: Collabora guarda los cambios y sobreescribe el archivo
router.post(
  "/files/:fileId/contents",
  express.raw({ type: "*/*", limit: "50mb" }),
  async (req, res) => {
    try {
      const { fileId } = req.params;

      // 1. Buscamos el documento (Corregido: usamos ruta_archivo)
      const docQuery = await pool.query(
        "SELECT ruta_archivo FROM doc_carpetas WHERE id = $1",
        [fileId],
      );
      if (docQuery.rows.length === 0)
        return res.status(404).send("Archivo no encontrado");

      // CORRECCIÓN APLICADA AQUÍ: Leemos 'ruta_archivo', no 'url_archivo'
      const filePath = path.resolve(docQuery.rows[0].ruta_archivo);

      // 2. Sobreescribimos el archivo físico con los nuevos binarios
      fs.writeFileSync(filePath, req.body);

      // 3. ACTUALIZAMOS LA FECHA EN LA BASE DE DATOS
      // Suponiendo que creaste una columna 'fecha_modificacion'
      await pool.query(
        `UPDATE doc_carpetas 
             SET fecha_modificacion = CURRENT_TIMESTAMP 
             WHERE id = $1`,
        [fileId],
      );

      // 4. Le respondemos a Collabora que todo salió perfecto
      res.sendStatus(200);
    } catch (error) {
      console.error("Error guardando archivo desde WOPI:", error);
      res.status(500).send("Error guardando archivo");
    }
  },
);

module.exports = router;
