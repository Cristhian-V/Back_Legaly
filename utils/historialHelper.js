// Archivo: utils/historialHelper.js
const pool = require('../db'); // Asegúrate de que la ruta a tu bd sea correcta

/**
 * Registra un evento en la tabla historial_caso.
 * @param {number} casoId - El ID interno del caso (integer)
 * @param {number} usuarioId - El ID del usuario que hizo la acción
 * @param {string} codigoHistorial - Ej: 'carga_doc', 'modificacion_doc'
 * @param {string} titulo - Título corto a mostrar
 * @param {string} descripcion - Detalle de lo que ocurrió
 */
const registrarHistorial = async (casoId, usuarioId, codigoTipoHistorial, titulo, descripcion) => {
    try {
        // 1. Buscamos el ID del tipo de historial basándonos en el código ("carga_doc" -> 3)
        const tipoQuery = await pool.query(
            'SELECT id FROM tipos_historial_caso WHERE codigo = $1', 
            [codigoTipoHistorial]
        );

        if (tipoQuery.rows.length === 0) {
            console.error(`Error: Código de historial '${codigoTipoHistorial}' no existe en el catálogo.`);
            return; // Salimos sin romper el programa
        }

        const tipoHistorialId = tipoQuery.rows[0].id;

        // 2. Guardamos el registro en el historial
        await pool.query(`
            INSERT INTO historial_caso (caso_id, tipo_historial_id, usuario_id, titulo, descripcion, fecha_hito)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `, [casoId, tipoHistorialId, usuarioId, titulo, descripcion]);

        console.log(`✅ Historial registrado: [${codigoTipoHistorial}] para el caso ${casoId}`);

    } catch (error) {
        // Solo imprimimos el error, pero NO detenemos la aplicación. 
        // Si el historial falla, el documento igual debería guardarse.
        console.error('Error al intentar registrar el historial:', error);
    }
};

module.exports = { registrarHistorial };