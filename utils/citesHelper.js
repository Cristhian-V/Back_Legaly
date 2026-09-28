const pool = require("../db");

const VIA_CORREO = "correo";
const VIA_ENTREGA_FISICA = "entrega física";
const VIAS_VALIDAS = [VIA_CORREO, VIA_ENTREGA_FISICA];

const CIUDAD_POR_DEFECTO = "Santa Cruz de la Sierra";

const MESES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const formatearFechaCite = (fecha = new Date()) => {
  const f = fecha instanceof Date ? fecha : new Date(fecha);
  return `${f.getDate()} de ${MESES_ES[f.getMonth()]} de ${f.getFullYear()}`;
};

const formatearNumeroCite = (numero, anio) =>
  `${String(numero).padStart(3, "0")}/${anio}`;

const etiquetaCite = (numero, anio) =>
  `A&P N.º ${formatearNumeroCite(numero, anio)}`;

const siguienteNumeroCite = async (anio, clientTx) => {
  const db = clientTx || pool;
  const resultado = await db.query(
    `INSERT INTO cites_correlativos (anio, ultimo) VALUES ($1, 1)
     ON CONFLICT (anio) DO UPDATE SET ultimo = cites_correlativos.ultimo + 1
     RETURNING ultimo`,
    [anio],
  );
  return resultado.rows[0].ultimo;
};

module.exports = {
  VIA_CORREO,
  VIA_ENTREGA_FISICA,
  VIAS_VALIDAS,
  CIUDAD_POR_DEFECTO,
  formatearFechaCite,
  formatearNumeroCite,
  etiquetaCite,
  siguienteNumeroCite,
};
