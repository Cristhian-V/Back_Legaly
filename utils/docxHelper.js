const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const RUTA_PLANTILLA = path.join(__dirname, "../plantillas/cite.docx");

const generarCartaCite = ({ numero, ciudad, fecha, destinatario, cargo_institucion }) => {
  const plantilla = fs.readFileSync(RUTA_PLANTILLA);
  const zip = new PizZip(plantilla);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  doc.render({
    numero,
    ciudad,
    fecha,
    destinatario: destinatario || "[NOMBRE DEL DESTINATARIO]",
    cargo_institucion: cargo_institucion || "[Cargo / Institución]",
  });

  return doc.getZip().generate({ type: "nodebuffer" });
};

module.exports = { generarCartaCite, RUTA_PLANTILLA };
