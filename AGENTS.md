# AGENTS.md

## Project overview

Backend API for a legal case management system (Bufete Alaiza Pedraza). Node.js + Express 5 + PostgreSQL (`pg`), CommonJS modules, no build step.

## Commands

```bash
# Start (use this, NOT `npm start` or `index.js`)
node server.js

# Docker build
docker build -t back_legaly .

# There is no lint, typecheck, or test command (stub only)
```

## Environment

Requires `.env` at root (not committed, ignored by git). Required vars:
- `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME` — PostgreSQL connection
- `JWT_SECRET` — JWT signing secret
- `PORT` — defaults to 3000
- `CORS_ORIGIN` — frontend origin (e.g. `http://localhost:5173`)
- `RUTA_DESTINO_BASE` — filesystem path for document storage (Windows path, hardcoded)

## Database

- PostgreSQL only. No ORM, no migrations — schema is managed externally.
- Pool via `db.js` (`const pool = new Pool(...)`), imported as `require('../db')`.
- **Transaction pattern**: some routes use `pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK` (e.g. `casosRoutes.js`, `clienteRoutes.js`, `docsueltosRoutes.js`). Simple queries use `pool.query()` directly.
- **Soft deletes**: users, clients, contacts, and documents set a boolean status column to `false` instead of physical DELETE.

## Auth

- JWT stored as an httpOnly cookie (`token`). Middleware at `middlewares/verifyToken.js` reads the cookie, verifies the JWT, and sets `req.user.userId`.
- Most routes require this middleware.

## Architecture

```
server.js              → Express app, mounts all routes
routes/               → Route handlers (one file per domain)
middlewares/verifyToken.js → JWT auth middleware
db.js                 → pg Pool singleton
utils/historialHelper.js  → Audit history helper for case actions
plantillas/           → Blank .docx/.pptx/.xlsx templates copied at runtime
```

## Code conventions

- **Spanish**: all variable names, function names, comments, DB column names, and error messages are in Spanish.
- **CommonJS** only (`require`/`module.exports`), do not use ES module syntax.
- **Single-pool pattern**: `db.js` exports one `pg.Pool`, reused across all route files.

## Document system

- Documents are stored on disk at `RUTA_DESTINO_BASE`, tracked in the `documentos` table.
- **Version control**: new versions create a row in `control_versiones` and the old file is renamed with a `_V{n}` suffix (see `docsRoutes.js`).
- WOPI protocol routes at `/wopi` enable Collabora Online editing.

## Key gotchas

- `package.json` `"main"` points to `index.js` which does **not** exist. The real entrypoint is `server.js`.
- `AGENTS.md` is listed in `.gitignore` — remove it from `.gitignore` to commit this file.
- `RUTA_DESTINO_BASE` is a hardcoded Windows-style path; change it per environment.
- No test infrastructure, no CI, no linting — don't look for these.
