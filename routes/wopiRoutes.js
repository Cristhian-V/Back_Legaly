const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const pool = require("../db"); // Tu conexión a PostgreSQL

// 1. CheckFileInfo: Collabora pide los metadatos del documento
router.get("/files/:fileId", async (req, res) => {
  try {
    console.log("esta mos aqui3333");
    const { fileId } = req.params;
    // Buscamos el documento en la base de datos
    const docQuery = await pool.query(
      "SELECT nombre, url_archivo, subido_por_id FROM documentos WHERE id = $1",
      [fileId],
    );

    if (docQuery.rows.length === 0)
      return res.status(404).send("Archivo no encontrado");
    const doc = docQuery.rows[0];
    const filePath = path.resolve(doc.url_archivo); // Ruta física en el servidor
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
    console.log("esta mos aqui 222");
    const { fileId } = req.params;
    const docQuery = await pool.query(
      "SELECT url_archivo FROM documentos WHERE id = $1",
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
      const docQuery = await pool.query(
        "SELECT url_archivo FROM documentos WHERE id = $1",
        [fileId],
      );
      if (docQuery.rows.length === 0)
        return res.status(404).send("Archivo no encontrado");

      const filePath = path.resolve(docQuery.rows[0].url_archivo);

      // Sobreescribimos el archivo físico con los nuevos binarios que manda Collabora
      fs.writeFileSync(filePath, req.body);
      console.log("esta mos aqui");
      // Opcional: Aquí podrías hacer un UPDATE a tu BD para cambiar la fecha de "ultima_modificacion"
      await pool.query(
        `UPDATE documentos 
             SET fecha_modificacion = CURRENT_TIMESTAMP 
             WHERE id = $1`,
        [fileId],
      );

      res.sendStatus(200); // Le decimos a Collabora: "OK, Guardado"
    } catch (error) {
      console.error("Error guardando archivo:", error);
      res.status(500).send("Error guardando archivo");
    }
  },
);

module.exports = router;
