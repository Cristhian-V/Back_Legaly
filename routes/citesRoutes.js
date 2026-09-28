const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const pool = require("../db");
const verifyToken = require("../middlewares/verifyToken");
const autorizarCaso = require("../middlewares/autorizarCaso");
const { registrarHistorial } = require("../utils/historialHelper");
const {
  VIAS_VALIDAS,
  CIUDAD_POR_DEFECTO,
  siguienteNumeroCite,
  formatearNumeroCite,
  formatearFechaCite,
  etiquetaCite,
} = require("../utils/citesHelper");
const { generarCartaCite } = require("../utils/docxHelper");

const RUTA_DESTINO_BASE = process.env.RUTA_DESTINO_BASE;

const obtenerTipoDocumentoCite = async (db) => {
  const resultado = await db.query(
    "SELECT id FROM tipo_documento WHERE nombre = 'CITE' LIMIT 1",
  );
  return resultado.rows.length > 0 ? resultado.rows[0].id : null;
};

const crearCite = async ({
  db,
  usuarioId,
  casoId,
  via,
  ref,
  destinatario,
  cargoInstitucion,
}) => {
  const fecha = new Date();
  const anio = fecha.getFullYear();
  const numero = await siguienteNumeroCite(anio, db);

  const tipoDocumentoId = await obtenerTipoDocumentoCite(db);

  const insDoc = await db.query(
    `INSERT INTO documentos
       (caso_id, subido_por_id, nombre, url_archivo, fecha_subida, tipo_documento_id, pesomb, fecha_modificacion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [casoId, usuarioId, "CITE.docx", "ruta_temporal", fecha, tipoDocumentoId, "0", fecha],
  );
  const documentoId = insDoc.rows[0].id;

  const numeroRelleno = String(numero).padStart(3, "0");
  const nombreArchivo = `${documentoId}_A&P-${numeroRelleno}-${anio}.docx`;
  const carpeta = path.join(RUTA_DESTINO_BASE, String(anio), "CITES");
  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }
  const rutaFisica = path.join(carpeta, nombreArchivo);

  const contenido = generarCartaCite({
    numero: formatearNumeroCite(numero, anio),
    ciudad: CIUDAD_POR_DEFECTO,
    fecha: formatearFechaCite(fecha),
    destinatario,
    cargo_institucion: cargoInstitucion,
  });
  fs.writeFileSync(rutaFisica, contenido);

  await db.query("UPDATE documentos SET nombre = $1, url_archivo = $2 WHERE id = $3", [
    nombreArchivo,
    rutaFisica,
    documentoId,
  ]);

  const insCite = await db.query(
    `INSERT INTO cites
       (numero, anio, via, ref, destinatario, cargo_institucion, creado_por_id, caso_id, documento_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      numero,
      anio,
      via,
      ref || null,
      destinatario || null,
      cargoInstitucion || null,
      usuarioId,
      casoId,
      documentoId,
    ],
  );

  return {
    cite: insCite.rows[0],
    documentoId,
    nombreArchivo,
    etiqueta: etiquetaCite(numero, anio),
  };
};

router.post("/", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const usuarioId = req.user.userId;
    const { via, ref, destinatario, cargo_institucion } = req.body;

    if (!VIAS_VALIDAS.includes(via)) {
      return res
        .status(400)
        .json({ error: "La VIA debe ser 'correo' o 'entrega física'." });
    }

    await client.query("BEGIN");
    const resultado = await crearCite({
      db: client,
      usuarioId,
      casoId: null,
      via,
      ref,
      destinatario,
      cargoInstitucion: cargo_institucion,
    });
    await client.query("COMMIT");

    res.status(201).json({
      message: "CITE creado exitosamente.",
      cite: resultado.cite,
      numero: resultado.etiqueta,
      documentoId: resultado.documentoId,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al crear CITE:", error);
    res.status(500).json({ error: "Error interno al crear el CITE." });
  } finally {
    client.release();
  }
});

router.post("/expediente/:id", verifyToken, autorizarCaso(), async (req, res) => {
  const client = await pool.connect();
  try {
    const usuarioId = req.user.userId;
    const casoId = req.casoId;
    const { via, ref } = req.body;
    let destinatario = req.body.destinatario;
    let cargoInstitucion = req.body.cargo_institucion;

    if (!VIAS_VALIDAS.includes(via)) {
      return res
        .status(400)
        .json({ error: "La VIA debe ser 'correo' o 'entrega física'." });
    }

    if (!destinatario) {
      const contacto = await pool.query(
        `SELECT cc.nombre_contacto, cc.cargo
         FROM casos c
         JOIN contactos_cliente cc ON cc.cliente_id = c.cliente_id AND cc.estado = true
         WHERE c.caso_id = $1
         ORDER BY cc.es_principal DESC, cc.id ASC
         LIMIT 1`,
        [casoId],
      );
      if (contacto.rows.length > 0) {
        destinatario = contacto.rows[0].nombre_contacto;
        if (!cargoInstitucion) {
          cargoInstitucion = contacto.rows[0].cargo;
        }
      }
    }

    await client.query("BEGIN");
    const resultado = await crearCite({
      db: client,
      usuarioId,
      casoId,
      via,
      ref,
      destinatario,
      cargoInstitucion,
    });

    await registrarHistorial(
      casoId,
      usuarioId,
      "creacion_cite",
      "Creación de CITE",
      `Se creó el CITE ${resultado.etiqueta} con destino a "${destinatario || "sin destinatario"}".`,
      client,
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "CITE creado exitosamente.",
      cite: resultado.cite,
      numero: resultado.etiqueta,
      documentoId: resultado.documentoId,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al crear CITE desde expediente:", error);
    res.status(500).json({ error: "Error interno al crear el CITE." });
  } finally {
    client.release();
  }
});

router.get("/", verifyToken, async (req, res) => {
  try {
    const usuarioId = req.user.userId;

    const query = `
      SELECT ci.id, ci.numero, ci.anio, ci.via, ci.ref, ci.destinatario,
             ci.cargo_institucion, ci.creado_por_id,
             u.nombre_completo AS creado_por,
             ci.caso_id, c.expediente_id, ci.documento_id,
             TO_CHAR(ci.creado_en, 'DD/MM/YYYY HH24:MI') AS creado_en,
             'A&P N.º ' || LPAD(ci.numero::text, 3, '0') || '/' || ci.anio AS etiqueta
      FROM cites ci
      LEFT JOIN usuarios u ON u.id = ci.creado_por_id
      LEFT JOIN casos c ON c.caso_id = ci.caso_id
      WHERE ci.creado_por_id = $1
         OR (
              ci.caso_id IS NOT NULL
              AND (
                c.responsable_id = $1
                OR c.caso_id IN (SELECT caso_id FROM equipo_caso WHERE usuario_id = $1)
              )
            )
      ORDER BY ci.creado_en DESC
    `;

    const resultado = await pool.query(query, [usuarioId]);
    res.json({ cites: resultado.rows });
  } catch (error) {
    console.error("Error al listar CITES:", error);
    res.status(500).json({ error: "Error interno al listar los CITES." });
  }
});

module.exports = router;
