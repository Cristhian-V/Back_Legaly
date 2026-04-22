// Archivo: server.js
require("dotenv").config(); // Carga las variables de entorno
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

// Importamos nuestras rutas
const authRoutes = require("./routes/authRoutes");
const inicioRoutes = require("./routes/inicio");
const casosRoutes = require("./routes/casosRoutes");
const usuarioRoutes = require("./routes/usuario");
const listadosRoutes = require("./routes/listadosRoutes");
const docsRoutes = require("./routes/docsRoutes");
const eventosCalendarioRoutes = require("./routes/EventosCalendarioRouter");
const clientesRouter = require("./routes/clienteRoutes");
const wopiRoutes = require("./routes/wopiRoutes");

const app = express();

app.use(express.json()); // Middleware para parsear JSON

// --- MEDIDAS DE SEGURIDAD GLOBALES ---

// 1. Helmet: Oculta información sensible en los encabezados HTTP
app.use(helmet());

// 2. CORS: Define qué dominios (front-end) pueden hablar con tu servidor
app.use(
  cors({
    origin: "http://localhost:5173", // Cambia esto por la URL de tu front-end
    credentials: true, // Permite enviar cookies
  }),
);

// 3. Rate Limiting: Evita ataques de fuerza bruta al login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Límite de 5 intentos por IP
  message:
    "Demasiados intentos de inicio de sesión, inténtalo de nuevo en 15 minutos",
});

// 4. Middlewares para leer datos
app.use(express.json()); // Permite leer datos en formato JSON
app.use(cookieParser()); // Permite leer las cookies de seguridad

// --- CONEXIÓN A BASE DE DATOS ---
// La conexión a la base de datos se maneja en authRoutes.js a través de db.js

// --- RUTAS ---
// Aplicamos el limitador de intentos solo a las rutas de autenticación
app.use("/api/auth", authRoutes); //añadir el limite de intentos en produccion loginLimiter
app.use("/api/user", usuarioRoutes);
app.use("/api/inicio", inicioRoutes);
app.use("/api/casos", casosRoutes);
app.use("/api/listados", listadosRoutes);
app.use("/api/docs", docsRoutes);
app.use("/api/calendario", eventosCalendarioRoutes); 
app.use("/api/cliente", clientesRouter); 
app.use("/wopi", wopiRoutes); 

// --- INICIAR SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor seguro corriendo en el puerto ${PORT}`);
});
