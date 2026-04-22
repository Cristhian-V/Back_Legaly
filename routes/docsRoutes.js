const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const verifyToken = require('../middlewares/verifyToken');
const fs = require('fs');
const { registrarHistorial } = require('../utils/historialHelper');

// Ruta absoluta base
const RUTA_DESTINO_BASE = 'D:/Cristhian Dev/AlaizaPedraza/Documentos';

// ==========================================
// FUNCIÓN AUXILIAR: Crea la ruta dinámica
// ==========================================
const obtenerRutaDinamica = (expedienteId) => {
  const anioActual = new Date().getFullYear().toString(); // Ej: "2024"
  // Resultado: D:/Cristhian Dev/AlaizaPedraza/Documentos/2024/CIV-2024-001
  return path.join(RUTA_DESTINO_BASE, anioActual, expedienteId);
};

// ==========================================
// CONFIGURACIÓN DE MULTER
// ==========================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 1. Obtenemos el ID del expediente desde la URL de la petición
    const expedienteId = req.params.id; 
    
    // 2. Calculamos la ruta dinámica (Año/Expediente)
    const rutaDinamica = obtenerRutaDinamica(expedienteId);

    // 3. Verificamos si la carpeta existe. Si no existe, la creamos.
    // recursive: true permite crear la del año y la del expediente juntas si ambas faltan
    if (!fs.existsSync(rutaDinamica)) {
      fs.mkdirSync(rutaDinamica, { recursive: true });
    }

    // 4. Le decimos a Multer que guarde el archivo en esta nueva carpeta
    cb(null, rutaDinamica);
  },
  filename: function (req, file, cb) {
    const prefijoUnico = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.originalname); // Aquí le podrías poner el prefijo si gustas
  }
});

// FILTRO PARA VALIDAR DUPLICADOS ANTES DE GUARDAR
const fileFilter = (req, file, cb) => {
  const expedienteId = req.params.id;
  const rutaDinamica = obtenerRutaDinamica(expedienteId);
  const rutaCompleta = path.join(rutaDinamica, file.originalname);

  if (fs.existsSync(rutaCompleta)) {
    return cb(new Error('ARCHIVO_DUPLICADO'), false);
  }

  cb(null, true);
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// ==========================================
// 1. OBTENER DOCUMENTACIÓN DE UN CASO (GET)
// ==========================================
router.get('/:id/documentacion', verifyToken, async (req, res) => {
  try {
    const casoId = req.params.id;
    const query = `
            SELECT 
              d.id,
              d.nombre,
              t.nombre AS tipo_Documento,
              d.fecha_subida,
              u.nombre_completo AS Responsable,
              d.pesoMB,
              d.url_archivo
            FROM documentos d
            JOIN casos c ON c.caso_id = d.caso_id
            JOIN usuarios u ON u.id = d.subido_por_id
            JOIN tipo_documento t ON t.id = d.tipo_documento_id
            WHERE c.expediente_id = $1 and d.estado_doc = true
            `;

    const documentacion = await pool.query(query, [casoId]);
    const documentosConExtension = documentacion.rows.map(doc => {
      // path.extname devuelve ".pdf". Con .replace('.', '') lo dejamos limpio como "pdf"
      const ext = path.extname(doc.nombre).replace('.', '').toLowerCase();
      
      return {
        ...doc,           // Mantiene todos los datos originales (id, nombre, etc.)
        extension: ext    // Agrega la nueva columna virtual
      };
    });

    res.json({ documentacion: documentosConExtension });
  } catch (error) {
    console.error('Error al obtener la documentación:', error);
    res.status(500).json({ error: 'Error al obtener la documentación del caso' });
  }
});

// ==========================================
// 2. AGREGAR DOCUMENTACIÓN A UN CASO (POST)
// ==========================================
router.post('/:id/documentacion', verifyToken, (req, res) => {

  upload.single('archivo')(req, res, async function (err) {
    
    if (err) {
      if (err.message === 'ARCHIVO_DUPLICADO') {
        return res.status(400).json({ error: 'El archivo que quiere subir ya existe en este expediente.' });
      }
      console.error("Error de Multer:", err);
      return res.status(500).json({ error: 'Error interno al subir el archivo.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se seleccionó ningún archivo para subir.' });
    }

    try {
      const casoId = req.params.id; 
      const usuario_id = req.user.userId;
      const { tipoDocumento } = req.body; 

      const casoData = await pool.query(`SELECT caso_id FROM casos WHERE expediente_id = $1`, [casoId]);

      if (casoData.rows.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Caso no encontrado' });
      }

      const nombreOriginal = req.file.filename;

      // 2. HACEMOS EL INSERT (Sin la URL final aún) PARA OBTENER EL ID
      // Fíjate que al final usamos RETURNING id
      const insertQuery = `
            INSERT INTO documentos 
            (caso_id, subido_por_id, nombre, url_archivo, fecha_subida, tipo_documento_id, pesoMB) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id;
        `;

      const nuevaDocumentacion = await pool.query(insertQuery, [
        casoData.rows[0].caso_id,
        usuario_id,               
        req.file.filename,        
        req.file.path,            // Guarda la nueva ruta dinámica completa
        new Date(),
        tipoDocumento,
        Math.trunc((req.file.size / (1024 * 1024))) 
      ]);

      const nuevoId = nuevaDocumentacion.rows[0].id;

      // 3. RENOMBRAMOS EL ARCHIVO FÍSICO AÑADIENDO EL ID EN SU MISMA CARPETA
      const nombreConId = `${nuevoId}_${nombreOriginal}`; 
      
      // Magia aquí: Obtenemos la carpeta exacta donde Multer guardó el archivo (Ej: .../2024/CIV-001)
      const carpetaDinamica = path.dirname(req.file.path); 
      const rutaFisicaNueva = path.join(carpetaDinamica, nombreConId);

      // Node.js renombra el archivo sin sacarlo de su carpeta
      fs.renameSync(req.file.path, rutaFisicaNueva);

      // 4. ACTUALIZAMOS LA BASE DE DATOS CON LA RUTA Y NOMBRE FINALES
      const updateQuery = `
          UPDATE documentos 
          SET nombre = $1, url_archivo = $2 
          WHERE id = $3 
          RETURNING *;
      `;

      const documentoFinal = await pool.query(updateQuery, [nombreConId, rutaFisicaNueva, nuevoId]);

      // REGISTRAR EN EL HISTORIAL
      await registrarHistorial(
          casoData.rows[0].caso_id,      // ID del caso
          usuario_id,                    // ID del abogado
          'carga_doc',                   // El código de tu tabla catálogo
          'Carga de Documento',  // Título
          `Se subió el archivo: "${nombreConId}".` // Descripción dinámica
      );

      res.status(201).json({
        message: 'Documento subido y registrado exitosamente con su ID.',
        documentacion: documentoFinal.rows[0]
      });

    } catch (error) {
      console.error('Error en base de datos:', error);
      // Si algo falla, borramos el archivo temporal
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Error al registrar la documentación' });
    }
  });
});

// ==========================================
// 3. SUBIR NUEVA VERSIÓN DE DOCUMENTO (POST)
// ==========================================
router.post('/:id/nueva_version', verifyToken, (req, res) => {
  upload.single('archivo')(req, res, async function (err) {

    if (!req.file) {
      return res.status(400).json({ error: 'Debes adjuntar el nuevo documento.' });
    }

    const documentoId = req.params.id; // ¡Ahora este ID será el mismo para siempre!
    const usuarioId = req.user.userId;

    try {
      // 1. Buscar el documento ACTUAL en la base de datos
      const queryActual = await pool.query('SELECT * FROM documentos WHERE id = $1', [documentoId]);
      
      if (queryActual.rows.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'El documento no existe.' });
      }

      const docActual = queryActual.rows[0];

      // 2. CONSULTAR VERSIONES PARA CALCULAR EL NÚMERO
      const versionQuery = await pool.query(
          `SELECT version_doc FROM control_versiones 
           WHERE documento_id = $1 
           ORDER BY id DESC LIMIT 1`, 
          [documentoId]
      );

      let numeroVersion = 1; 

      const extension = path.extname(docActual.nombre); 
      let nombreSinExtension = path.basename(docActual.nombre, extension);

      if (versionQuery.rows.length > 0 && versionQuery.rows[0].version_doc != null) {
        numeroVersion = parseInt(versionQuery.rows[0].version_doc) + 1;
        nombreSinExtension = nombreSinExtension.replace(/_V\d+$/, '');  
      } 

      // 3. ARCHIVAR EL ARCHIVO VIEJO FÍSICAMENTE
      const nombreViejoArchivado = `${nombreSinExtension}_V${numeroVersion}${extension}`;
      const rutaFisicaVieja = docActual.url_archivo; 
      const carpetaCorrecta = path.dirname(rutaFisicaVieja);
      const rutaFisicaViejaArchivada = path.join(carpetaCorrecta, nombreViejoArchivado);
          
      if (fs.existsSync(rutaFisicaVieja)) {
        // Renombramos el archivo viejo (ej. 42_memorial.pdf -> 42_memorial_V1.pdf)
        fs.renameSync(rutaFisicaVieja, rutaFisicaViejaArchivada);
      }

      // 4. REGISTRAR EL ARCHIVO VIEJO EN EL CONTROL DE VERSIONES
      // Guardamos la URL de donde quedó el archivo viejo archivado
      await pool.query(`
        INSERT INTO control_versiones (documento_id, modificado_por_id, fecha_modificacion, comentarios_cambio, caso_id, version_doc, doc_url)
        VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6)
      `, [documentoId, usuarioId, req.body.comentarios || null, docActual.caso_id, numeroVersion, rutaFisicaViejaArchivada]);

      // 5. PROCESAR EL NUEVO ARCHIVO SUBIDO
      // Le ponemos el prefijo del ID (que nunca cambia) al nuevo archivo
      const nombreNuevoOriginal = req.file.filename; 
      const nombreConIdNuevo = `${documentoId}_${nombreNuevoOriginal}`; 
      
      const rutaFisicaNueva = path.join(carpetaCorrecta, nombreConIdNuevo);

      // Movemos el archivo nuevo de la carpeta temporal de Multer a su lugar final
      fs.renameSync(req.file.path, rutaFisicaNueva);

      // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
      // Borrar la carpeta "basura" que Multer creó por error
      // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
      const carpetaTemporalMulter = path.dirname(req.file.path); 
      
      // rmdirSync borra carpetas (solo si están vacías, lo cual es muy seguro)
      if (fs.existsSync(carpetaTemporalMulter)) {
          try {
              fs.rmdirSync(carpetaTemporalMulter); 
          } catch (err) {
              // Si falla (ej. otro archivo subiéndose al mismo tiempo), no rompemos el servidor
              console.warn("No se pudo borrar la carpeta temporal:", err.message);
          }
      }
      // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

      // 6. ACTUALIZAR EL REGISTRO PRINCIPAL EN LA BD
      // Ahora la tabla documentos SIEMPRE apunta a la versión más reciente
      const updateQuery = `
          UPDATE documentos 
          SET nombre = $1, url_archivo = $2, fecha_subida = CURRENT_TIMESTAMP, subido_por_id = $3
          WHERE id = $4 
          RETURNING *;
      `;
      const documentoFinal = await pool.query(updateQuery, [nombreConIdNuevo, rutaFisicaNueva, usuarioId, documentoId]);

      // 7. REGISTRAR EN EL HISTORIAL DE AUDITORÍA
      await registrarHistorial(
          docActual.caso_id,             // ID del caso
          usuarioId,                     // ID del abogado
          'modificacion_doc',            // Código
          'Actualización de Documento',  // Título
          `El archivo "${nombreSinExtension}" fue actualizado a la versión ${numeroVersion + 1}.` 
      );

      res.status(201).json({
        mensaje: `Documento actualizado con éxito. El original se guardó como versión ${numeroVersion}.`,
        documento: documentoFinal.rows[0]
      });

    } catch (error) {
      console.error('Error al procesar la nueva versión:', error);
      // Limpieza de emergencia si algo falla
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Error interno al actualizar la versión del documento.' });
    }
  });
});

// RUTA GET: Para VER el documento enviando la ruta exacta
router.get('/ver', (req, res) => {
  // Extraemos la ruta que enviamos desde React (?ruta=...)
  const rutaCompleta = req.query.ruta;
  console.log("Ruta completa recibida para ver el documento:", rutaCompleta);

  if (!rutaCompleta) {
    return res.status(400).json({ error: 'No se proporcionó la ruta del archivo.' });
  }

  // Comprobamos si el archivo realmente existe en el disco duro del servidor
  if (fs.existsSync(rutaCompleta)) {
    // res.sendFile agarra el archivo de esa ruta y lo dibuja en el navegador
    res.sendFile(rutaCompleta);
  } else {
    // Si el registro está en la BD pero alguien borró el PDF físicamente de la carpeta
    res.status(404).send('El documento no existe físicamente en el servidor o fue movido.');
  }
});

// RUTA DELETE: Usamos /:id en la URL (Mejor práctica para DELETE)
router.delete('/:id/eliminar', verifyToken, async (req, res) => {
  try {
    // 1. Extraemos el ID directamente desde la URL (params)
    const id = req.params.id; 
    const usuarioId = req.user.userId;

    // 2. Buscamos el archivo en la base de datos (AHORA ESTÁ DENTRO DEL TRY)
    const resultadoBusqueda = await pool.query('SELECT url_archivo, nombre, caso_id FROM documentos WHERE id = $1', [id]);

    // 3. Validamos que el documento realmente exista en la BD
    if (resultadoBusqueda.rows.length === 0) {
      return res.status(404).json({ error: 'El documento no existe o ya fue eliminado.' });
    }

    const urlFisica = resultadoBusqueda.rows[0].url_archivo;
    const nombreDocumento = resultadoBusqueda.rows[0].nombre;
    const casoId = resultadoBusqueda.rows[0].caso_id;

    // 4. Lo borramos físicamente del disco duro si existe
    if (urlFisica && fs.existsSync(urlFisica)) {
      fs.unlinkSync(urlFisica); 
    }

    // 5. Hacemos el DELETE lógico en PostgreSQL (Usando la variable 'id', no 'docId')
    await pool.query('UPDATE documentos SET estado_doc = false WHERE id = $1', [id]);

    // REGISTRAR EN EL HISTORIAL
    await registrarHistorial(
        casoId,     // ID del caso
        usuarioId,                    // ID del abogado
        'eliminacion_doc',                   // El código de tu tabla catálogo
        'Eliminación de Documento',  // Título
        `Se eliminó el documento: "${nombreDocumento}".` // Descripción dinámica
    );

    res.status(200).json({ mensaje: 'Documento eliminado correctamente' });

  } catch (error) {
    console.error("Error al eliminar el archivo:", error);
    res.status(500).json({ error: 'No se pudo eliminar el documento.' });
  }
});

module.exports = router;