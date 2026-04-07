const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const verifyToken = require('../middlewares/verifyToken');
const fs = require('fs');

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
              d.nombre,
              t.nombre AS tipo_Documento,
              d.fecha_subida,
              u.nombre_completo AS Responsable,
              d.pesoMB
            FROM documentos d
            JOIN casos c ON c.caso_id = d.caso_id
            JOIN usuarios u ON u.id = d.subido_por_id
            JOIN tipo_documento t ON t.id = d.tipo_documento_id
            WHERE c.expediente_id = $1
            `;

    const documentacion = await pool.query(query, [casoId]);
    res.json({ documentacion: documentacion.rows });
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

      const insertQuery = `
            INSERT INTO documentos 
            (caso_id, subido_por_id, nombre, url_archivo, fecha_subida, tipo_documento_id, pesoMB) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
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

      res.status(201).json({
        message: 'Documento subido y registrado exitosamente',
        documentacion: nuevaDocumentacion.rows[0]
      });

    } catch (error) {
      console.error('Error al guardar en base de datos:', error);
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Error al registrar la documentación en el sistema' });
    }
  });
});

module.exports = router;