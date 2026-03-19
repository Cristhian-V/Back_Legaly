// Archivo: db.js
const { Pool } = require('pg');
require('dotenv').config();

// Creamos un "Pool" de conexiones. 
// Es una forma eficiente de manejar múltiples peticiones a la base de datos al mismo tiempo.
const pool = new Pool({
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    database: process.env.PG_DATABASE,
});

module.exports = pool;