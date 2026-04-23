// Archivo: db.js
const { Pool } = require('pg');
require('dotenv').config();

// Creamos un "Pool" de conexiones. 
// Es una forma eficiente de manejar múltiples peticiones a la base de datos al mismo tiempo.
const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
});

module.exports = pool;