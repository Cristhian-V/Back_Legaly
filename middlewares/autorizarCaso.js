const pool = require("../db");

// ==========================================
// RESOLVERS: traducen un identificador de la ruta al caso_id interno.
// Devuelven null cuando el recurso no existe (para responder 404 antes que 403).
// ==========================================

// Acepta tanto un expediente_id (ej. "LIT-2026-0001") como un caso_id numérico.
async function resolverPorExpedienteOId(valor) {
  const texto = String(valor);
  const porExpediente = await pool.query(
    "SELECT caso_id FROM casos WHERE expediente_id = $1",
    [texto],
  );
  if (porExpediente.rows.length > 0) {
    return porExpediente.rows[0].caso_id;
  }

  if (/^\d+$/.test(texto)) {
    const porId = await pool.query(
      "SELECT caso_id FROM casos WHERE caso_id = $1",
      [Number(texto)],
    );
    if (porId.rows.length > 0) {
      return porId.rows[0].caso_id;
    }
  }

  return null;
}

// Rutas direccionadas por el id de una solicitud de revisión.
async function resolverPorRevision(valor) {
  const resultado = await pool.query(
    "SELECT caso_id FROM revisiones_caso WHERE id = $1",
    [valor],
  );
  return resultado.rows.length > 0 ? resultado.rows[0].caso_id : null;
}

// Rutas direccionadas por el id de un documento.
async function resolverPorDocumento(valor) {
  const resultado = await pool.query(
    "SELECT caso_id FROM documentos WHERE id = $1",
    [valor],
  );
  return resultado.rows.length > 0 ? resultado.rows[0].caso_id : null;
}

// Rutas direccionadas por el id de un evento de caso.
async function resolverPorEvento(valor) {
  const resultado = await pool.query(
    "SELECT caso_id FROM eventos_calendario WHERE id = $1",
    [valor],
  );
  return resultado.rows.length > 0 ? resultado.rows[0].caso_id : null;
}

// ==========================================
// REGLA DE ACCESO: admin (rol 1) ve todo; el resto solo si es
// responsable del caso o miembro de su equipo (equipo_caso).
// ==========================================
async function puedeAccederCaso(usuarioId, casoId) {
  const resultado = await pool.query(
    `SELECT u.rol_id,
            EXISTS (
              SELECT 1 FROM casos c
              WHERE c.caso_id = $2
                AND (
                  c.responsable_id = u.id
                  OR EXISTS (
                    SELECT 1 FROM equipo_caso e
                    WHERE e.caso_id = c.caso_id AND e.usuario_id = u.id
                  )
                )
            ) AS tiene_acceso
     FROM usuarios u
     WHERE u.id = $1`,
    [usuarioId, casoId],
  );

  if (resultado.rows.length === 0) {
    return false;
  }

  const { rol_id, tiene_acceso } = resultado.rows[0];
  return rol_id === 1 || tiene_acceso === true;
}

// ==========================================
// MIDDLEWARE: fábrica configurable.
//   fuente:  'params' | 'query' | 'body' (dónde viene el identificador)
//   clave:   nombre del campo (por defecto 'id')
//   resolver: función (valor) => Promise<caso_id|null>
// ==========================================
function autorizarCaso({
  fuente = "params",
  clave = "id",
  resolver = resolverPorExpedienteOId,
} = {}) {
  return async (req, res, next) => {
    try {
      const usuarioId = req.user?.userId;
      if (!usuarioId) {
        return res
          .status(401)
          .json({ error: "Acceso denegado. Necesitas iniciar sesión." });
      }

      const origen = req[fuente] || {};
      const valor = origen[clave];

      if (valor === undefined || valor === null || valor === "") {
        return res
          .status(400)
          .json({ error: "Falta el identificador del expediente." });
      }

      const casoId = await resolver(valor);
      if (!casoId) {
        return res
          .status(404)
          .json({ error: "El caso especificado no existe." });
      }

      const permitido = await puedeAccederCaso(usuarioId, casoId);
      if (!permitido) {
        return res
          .status(403)
          .json({ error: "No tienes acceso a este expediente." });
      }

      // Disponible para los handlers posteriores.
      req.casoId = casoId;
      next();
    } catch (error) {
      console.error("Error al validar el acceso al caso:", error);
      res.status(500).json({
        error: "Error interno al validar el acceso al expediente.",
      });
    }
  };
}

module.exports = autorizarCaso;
module.exports.resolverPorExpedienteOId = resolverPorExpedienteOId;
module.exports.resolverPorRevision = resolverPorRevision;
module.exports.resolverPorDocumento = resolverPorDocumento;
module.exports.resolverPorEvento = resolverPorEvento;
module.exports.puedeAccederCaso = puedeAccederCaso;
