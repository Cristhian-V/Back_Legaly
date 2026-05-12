# API Endpoints — Backend Legaly

Base URL: `http://localhost:3000` (configurable via `PORT` en `.env`)

**Autenticacion:** JWT via cookie httpOnly (`token`). El frontend debe usar `credentials: "include"` en `fetch`/axios.

**Convencion:** todas las respuestas y nombres de campos estan en español.

---

## `/api/auth` — Autenticacion

### `POST /api/auth/login`
Login. Establece cookie `token` httpOnly (maxAge 1h).

| Body | Tipo | Requerido |
|---|---|---|
| `name_user` | string | Si |
| `password` | string | Si |

Respuesta: `{ message: "Inicio de sesión exitoso" }`

---

### `GET /api/auth/verify`
Verifica sesion activa. Usado al cargar la app.

Respuesta: `{ isAuthenticated: true, user: { id, nombre_usuario, email, rol_id } }`

---

### `POST /api/auth/logout`
Cierra sesion. Limpia la cookie `token`.

Respuesta: `{ message: "Sesión cerrada exitosamente" }`

---

## `/api/user` — Usuarios y areas legales

### `POST /api/user/register`
Registra nuevo usuario. **Publico (sin auth).**

| Body | Tipo | Requerido | Default |
|---|---|---|---|
| `name_user` | string | Si | — |
| `nombre_completo` | string | Si | — |
| `email` | string | Si | — |
| `password` | string | Si | — |
| `rol_usuario` | number | Si | — |
| `grado_id` | number | Si | — |
| `estado_usuario` | number | No | `1` |
| `telefono` | string | No | `""` |
| `biografia` | string | No | `""` |
| `avatar_url` | string | No | `""` |

Respuesta: `{ message, user: {...} }`

---

### `GET /api/user/data`
Lista usuarios. **Rol 1 ve todos; otros solo su propio registro.**

Respuesta: `{ user: [{ id, nombre_usuario, nombre_completo, email, rol_id, rol_nombre, estado_id, telefono, biografia, avatar_url, grado_id, grado_academico_abreviado, grado_academico }] }`

---

### `GET /api/user/data/:id`
Obtiene un usuario por ID.

Respuesta: `{ user: {...} }` (objeto simple, no array)

---

### `PUT /api/user/mod/:id`
Actualiza usuario. **Todos los campos son opcionales** (usa COALESCE, solo actualiza lo enviado). Siempre reactiva al usuario (`estado_id = 1`).

| Body | Tipo | Requerido |
|---|---|---|
| `name_user` | string | No |
| `nombre_completo` | string | No |
| `email` | string | No |
| `rol_usuario` | number | No |
| `telefono` | string | No |
| `biografia` | string | No |
| `avatar_url` | string | No |
| `grado_id` | number | No |
| `password` | string | No |

Respuesta: `{ message, user: { id, nombre_usuario, nombre_completo, email, telefono, estado_id } }`

---

### `DELETE /api/user/delete/:id`
Soft-delete de usuario (`estado_id = 2`).

Respuesta: `{ message, user: { id, nombre_usuario, estado_id } }`

---

---

### `GET /api/user/area`
Usuarios activos con al menos un area legal asignada, con sus areas agrupadas.

Respuesta:
```json
[
  {
    "id": 5,
    "nombre_completo": "Juan Perez",
    "email": "juan@ejemplo.com",
    "avatar_url": "...",
    "estado_id": 1,
    "rol": "Abogado",
    "areas_legales": [
      { "id": 1, "nombre": "Litigios", "codigo": "LIT" },
      { "id": 3, "nombre": "Corporativo", "codigo": "CORP" }
    ]
  }
]
```

---

### `POST /api/user/area`
Asigna usuario a una o varias areas legales.

| Body | Tipo | Requerido |
|---|---|---|
| `usuario_id` | number | Si |
| `areas_legales_ids` | number[] | Si |

Respuesta: `{ message, total_enviadas, asignadas }`

---

### `DELETE /api/user/area`
Remueve usuario de un area legal.

| Body | Tipo | Requerido |
|---|---|---|
| `usuario_id` | number | Si |
| `area_legal_id` | number | Si |

Respuesta: `{ message }`

---

## `/api/inicio` — Dashboard / pantalla principal

### `GET /api/inicio/userData`
Datos del usuario autenticado para el header.

Respuesta: `{ dataUsuario: { id, nombre_completo, rol, avatar_url } }`

---

### `GET /api/inicio/casosUsusario`
Resumen de casos activos + proximos eventos (30 dias).

Respuesta: `{ resumen: { casosActivos, eventosActivos }, Eventos: [{ id, titulo, fecha_hora, tipo_evento, expediente_id }] }`

---

### `GET /api/inicio/eventos`
Eventos en rango (-10/+20 dias desde hoy).

Respuesta: `{ Eventos: [{ fecha, hora, tipo, titulo, descripcion }] }`

---

### `GET /api/inicio/revisiones/pendientes`
Revisiones pendientes donde el usuario es revisor.

Respuesta: `{ mensaje, casos_pendientes, pendientes: [{ revision_id, expediente_id, descripcion_corta, solicitado_por, fecha_envio, comentarios_solicitud, estado_id }] }`

---

## `/api/casos` — Expedientes / casos

### `GET /api/casos?tipo=activos`
Lista de casos. Query param `tipo`: `"activos"` (default) o `"historial"`. No-admin solo ve casos donde es responsable o parte del equipo.

Respuesta: `{ total, casos: [{ expediente_id, cliente_nombre, descripcion_corta, area_legal, responsable_nombre, fecha_apertura, estado_nombre }] }`

---

### `POST /api/casos`
Crea nuevo caso con transaccion. Genera `expediente_id = {codigoArea}-{año}-{NNNN}`.

| Body | Tipo | Requerido |
|---|---|---|
| `area_legal_id` | number | Si |
| `cliente_id` | number | Si |
| `responsable_id` | number | Si |
| `descripcion_corta` | string | Si |
| `descripcion_completa` | string | Si |
| `contraparte` | string | No |
| `fecha_inicio` | date | No |

Respuesta: `{ message, caso: {...} }`

---

### `GET /api/casos/:id`
Detalle de un caso por `expediente_id`.

| Param | Tipo |
|---|---|
| `id` | string (expediente_id) |

Respuesta: `{ caso: { categoria_cliente, expediente_id, estado, estado_revision, titulo, nombre_cliente, descripcion, fecha_inicio, contraparte } }`

---

### `PUT /api/casos/:id`
Actualiza datos del caso. **Todos los campos se actualizan** (no usa COALESCE — el frontend debe enviar los valores actuales si no cambian).

| Param | Tipo |
|---|---|
| `id` | string (expediente_id) |

| Body | Tipo |
|---|---|
| `area_legal_id` | number |
| `cliente_id` | number |
| `responsable_id` | number |
| `descripcion_corta` | string |
| `descripcion_completa` | string |
| `contraparte` | string |

Respuesta: `{ message }`

---

### `GET /api/casos/formData/:id`
Solo los 3 IDs necesarios para el formulario de edicion.

| Param | Tipo |
|---|---|
| `id` | string (expediente_id) |

Respuesta: `{ caso: { cliente_id, area_legal_id, responsable_id } }`

---

### `PUT /api/casos/:id/cerrar`
Cierra un caso (`estado_id=3`, `fecha_cierre`).

| Param | Tipo |
|---|---|
| `id` | string (expediente_id) |

Respuesta: `{ message, caso: { caso_id, expediente_id, descripcion_corta } }`

---

### `GET /api/casos/:id/historial`
Historial de auditoria del caso, agrupado por fecha.

| Param | Tipo |
|---|---|
| `id` | string (expediente_id) |

Respuesta: `{ total_eventos, historial: [{ fecha_etiqueta, eventos: [{ id, tipo, titulo, descripcion, hora, autor, autor_id, avatar }] }] }`

---

### `GET /api/casos/:id/revisionActiva`
ID de la revision activa actual del caso.

| Param | Tipo |
|---|---|
| `id` | string (expediente_id) |

Respuesta: `{ id_activo }`

---

### `POST /api/casos/:id/revisiones`
Envia caso/documentos a revision.

| Param | Tipo |
|---|---|
| `id` | string (expediente_id) |

| Body | Tipo | Requerido |
|---|---|---|
| `revisor_id` | number | Si |
| `comentarios_solicitud` | string | No |
| `documentos_ids` | number[] | No |

Respuesta: `{ message, revision_id, estado_asignado: "Pendiente" }`

---

### `PATCH /api/casos/revisiones/:id_revision/cancelar`
Cancela una solicitud de revision. Solo el solicitante puede.

| Param | Tipo |
|---|---|
| `id_revision` | number |

Respuesta: `{ message }`

---

### `PATCH /api/casos/revisiones/:id/iniciar`
Inicia revision (Pendiente -> En Revision). Solo el revisor asignado.

| Param | Tipo |
|---|---|
| `id` | number |

Respuesta: `{ message, estado_id: 4, expediente_id }`

---

### `PUT /api/casos/revisiones/:id_revision`
Responde/cierra revision. Solo el revisor asignado.

| Param | Tipo |
|---|---|
| `id_revision` | number |

| Body | Tipo | Requerido | Valores |
|---|---|---|---|
| `estado_revision_id` | number | Si | `2`=Aprobado, `3`=Con Observaciones, `5`=Revisado |
| `comentarios_revisor` | string | No | — |

Respuesta: `{ message, estado_id }`

---

### `GET /api/casos/equipo?expediente_id=EXP-2026-0001`
Equipo del caso.

Respuesta: `{ equipo: [{ id, nombre_completo, avatar_url, email, telefono, titulo, descripcion_titulo }] }`

---

### `POST /api/casos/equipo`
Agrega miembros al equipo. Usa `ON CONFLICT DO NOTHING`.

| Body | Tipo | Requerido |
|---|---|---|
| `expediente_id` | string | Si |
| `usuarios_ids` | number[] | Si |

Respuesta: `{ message }`

---

### `DELETE /api/casos/equipo`
Remueve un miembro del equipo.

| Body | Tipo | Requerido |
|---|---|---|
| `expediente_id` | string | Si |
| `usuario_id` | number | Si |

Respuesta: `{ message }`

---

### `GET /api/casos/:expediente_id/contactos-asignados`
Contactos ya vinculados al caso.

Respuesta: `[{ vinculacion_id, ...contacto }]`

---

### `GET /api/casos/:expediente_id/contactos-disponibles`
Contactos del cliente del caso (no necesariamente vinculados).

Respuesta: `[{ ...contacto }]`

---

### `POST /api/casos/:expediente_id/contactos`
Vincula contactos al caso.

| Body | Tipo | Requerido |
|---|---|---|
| `contactos_ids` | number[] | Si |

Respuesta: `{ message }`

---

### `DELETE /api/casos/:caso_id/contactos/:contacto_id`
Desvincula un contacto del caso.

| Param | Tipo |
|---|---|
| `caso_id` | string (expediente_id) |
| `contacto_id` | number |

Respuesta: `{ message }`

---

## `/api/eventos` — Calendario (casos + usuarios)

### `GET /api/eventos`
Todos los eventos (calendario de casos + eventos de usuario). **Rol 1 ve todo. Otros ven:**
- Eventos de casos donde estan en `equipo_caso` o comparten `area_legal`
- Eventos de usuario donde son creador o participante

Respuesta: `[{ origen: "caso"|"usuario", expediente_id, evento_id, titulo, descripcion, fecha_hora, tipo_evento, creado_por }]`

---

### `GET /api/eventos/caso/:caso_id`
Solo eventos de un caso especifico.

| Param | Tipo |
|---|---|
| `caso_id` | string (expediente_id) |

Respuesta: `[{ expediente_id, evento_id, titulo, descripcion, fecha_hora, tipo_evento }]`

---

### `POST /api/eventos`
Crea evento vinculado a un caso.

| Body | Tipo | Requerido |
|---|---|---|
| `titulo` | string | Si |
| `fecha_hora` | datetime | Si |
| `tipo_evento_id` | number | Si |
| `caso_id` | string | Si (expediente_id) |
| `descripcion` | string | No |

Respuesta: `{ message, evento: number }`

---

### `PUT /api/eventos/:id`
Modifica evento de caso.

| Param | Tipo |
|---|---|
| `id` | number |

| Body | Tipo | Requerido |
|---|---|---|
| `titulo` | string | No |
| `descripcion` | string | No |
| `fecha_hora` | datetime | No |
| `tipo_evento_id` | number | No |

Respuesta: `{ message, evento: {...} }`

---

### `DELETE /api/eventos/:id`
Elimina evento de caso.

| Param | Tipo |
|---|---|
| `id` | number |

Respuesta: `{ message }`

---

### `GET /api/eventos/usuario`
Solo eventos de usuario (personales/de equipo). **Rol 1 ve todos; otros ven los propios.**

Respuesta: `[{ evento_id, titulo, descripcion, fecha_hora, tipo_evento, creado_por, creado_por_id }]`

---

### `POST /api/eventos/usuario`
Crea evento de usuario. El creador se agrega automaticamente como participante.

| Body | Tipo | Requerido | Default |
|---|---|---|---|
| `titulo` | string | Si | — |
| `fecha_hora` | datetime | Si | — |
| `tipo_evento_id` | number | Si | — |
| `descripcion` | string | No | null |
| `participantes_ids` | number[] | No | [] |

Respuesta: `{ message, evento_id }`

---

### `DELETE /api/eventos/usuario/:id`
Elimina evento de usuario. **Solo el creador puede eliminarlo** (403 si no).

| Param | Tipo |
|---|---|
| `id` | number |

Respuesta: `{ message }`

---

## `/api/listados` — Datos maestros para formularios

### `GET /api/listados`
Todos los dropdowns en una sola llamada (9 queries en paralelo).

Respuesta:
```json
{
  "clientes": [{ "id", "nombre" }],
  "usuarios": [{ "id", "nombre_completo", "nombre_usuario" }],
  "catalogos": {
    "roles_usuario": [{ "id", "nombre" }],
    "grados_academicos": [{ "id", "nombre" }],
    "categorias_cliente": [{ "id", "nombre" }],
    "estados_caso": [{ "id", "nombre" }],
    "area_legal": [{ "id", "nombre" }],
    "tipos_evento": [{ "id", "nombre", "activo", "color" }],
    "tipos_documento": [{ "id", "nombre" }]
  }
}
```

---

## `/api/docs` — Documentos de casos

### `GET /api/docs/:id/documentacion`
Documentos de un caso.

| Param | Tipo |
|---|---|
| `id` | string (expediente_id) |

Respuesta: `{ documentacion: [{ id, nombre, fecha_subida, Responsable, pesoMB, url_archivo, fecha_modificacion, solicitud_revision, extension }] }`

---

### `POST /api/docs/:id/documentacion`
Sube archivo a un caso. **multipart/form-data**.

| Param | Tipo |
|---|---|
| `id` | string (expediente_id) |

| Form field | Tipo | Requerido |
|---|---|---|
| `archivo` | File | Si |
| `tipoDocumento` | number | No |

Respuesta: `{ message, documentacion: {...} }`

---

### `POST /api/docs/:id/crearDocumento`
Crea documento en blanco desde plantilla (Word, Excel, PPT).

| Param | Tipo |
|---|---|
| `id` | string (expediente_id) |

| Body | Tipo | Requerido |
|---|---|---|
| `nombreArchivo` | string | Si (sin extension) |
| `tipoPlantilla` | string | Si (`"word"`, `"excel"`, `"powerpoint"`) |
| `tipoDocumento` | number | No |

Respuesta: `{ message, documentacion: {...} }`

---

### `POST /api/docs/:id/nueva_version`
Sube nueva version de un documento. La version anterior se archiva con sufijo `_V{n}`. **multipart/form-data**.

| Param | Tipo |
|---|---|
| `id` | number (documento ID) |

| Form field | Tipo | Requerido |
|---|---|---|
| `archivo` | File | Si |
| `comentarios` | string | No |

Respuesta: `{ mensaje, documento: {...} }`

---

### `GET /api/docs/descargar?ruta={path}`
Descarga archivo por ruta absoluta. **Publico (sin auth).**

Respuesta: stream del archivo

---

### `DELETE /api/docs/:id/eliminar`
Elimina documento (fisico en disco + soft-delete en BD).

| Param | Tipo |
|---|---|
| `id` | number (documento ID) |

Respuesta: `{ mensaje }`

---

## `/api/cliente` — Clientes y contactos

### `GET /api/cliente`
Todos los clientes activos.

Respuesta: `[{ ...cliente, categoria }]`

---

### `POST /api/cliente`
Crea cliente.

| Body | Tipo | Requerido |
|---|---|---|
| `nombre_completo` | string | Si |
| `documento_identidad` | string | Si |
| `correo_electronico` | string | Si |
| `telefono` | string | Si |
| `direccion` | string | Si |
| `categoria_id` | number | Si |

Respuesta: `{ message, cliente: {...} }`

---

### `PUT /api/cliente/:id`
Actualiza cliente.

| Param | Tipo |
|---|---|
| `id` | number |

| Body | Tipo | Requerido |
|---|---|---|
| `nombre_completo` | string | Si |
| `documento_identidad` | string | Si |
| `correo_electronico` | string | Si |
| `telefono` | string | Si |
| `direccion` | string | Si |
| `categoria_id` | number | Si |

Respuesta: `{ message, cliente: {...} }`

---

### `DELETE /api/cliente/:id`
Soft-delete de cliente (`estado = false`).

Respuesta: `{ message }`

---

### `GET /api/cliente/:cliente_id/contactos`
Contactos de un cliente.

Respuesta: `[{ ...contacto }]`

---

### `POST /api/cliente/:cliente_id/contactos`
Crea contacto. Si `es_principal=true`, destrona al anterior principal.

| Body | Tipo | Requerido | Default |
|---|---|---|---|
| `nombre_contacto` | string | Si | — |
| `cargo` | string | Si | — |
| `telefono` | string | Si | — |
| `email` | string | Si | — |
| `es_principal` | boolean | No | false |

Respuesta: `{ message, contacto: {...} }`

---

### `PUT /api/cliente/contactos/:id`
Actualiza contacto.

| Body | Tipo | Requerido |
|---|---|---|
| `nombre_contacto` | string | Si |
| `cargo` | string | Si |
| `telefono` | string | Si |
| `email` | string | Si |
| `es_principal` | boolean | Si |
| `cliente_id` | number | Si |

Respuesta: `{ message, contacto: {...} }`

---

### `DELETE /api/cliente/contactos/:id`
Soft-delete de contacto (`estado = false`).

Respuesta: `{ message }`

---

## `/api/docsueltos` — Documentos sueltos (carpetas)

### `GET /api/docsueltos/carpetas`
Lista todas las carpetas.

Respuesta: `[{ id, nombre_carpeta, ruta }]`

---

### `POST /api/docsueltos/carpetas`
Crea carpeta (fisica en disco + registro en BD).

| Body | Tipo | Requerido |
|---|---|---|
| `nombre_carpeta` | string | Si |

Respuesta: `{ message, carpeta: {...} }`

---

### `PUT /api/docsueltos/carpetas/:id`
Renombra carpeta y actualiza rutas de archivos hijos (transaccion).

| Body | Tipo |
|---|---|
| `nuevo_nombre` | string |

Respuesta: `{ message, carpeta: {...} }`

---

### `DELETE /api/docsueltos/carpetas/:id`
Elimina carpeta solo si esta vacia.

Respuesta: `{ message }`

---

### `GET /api/docsueltos/carpetas/:id_carpeta`
Documentos dentro de una carpeta (solo los compartidos con el usuario via `equipo_documentos`).

Respuesta: `{ nombre_carpeta, documentos: [{ ... }] }`

---

### `POST /api/docsueltos/carpetas/:carpeta_id/documentos`
Sube archivo a carpeta. **multipart/form-data**. Transaccion.

| Form field | Tipo |
|---|---|
| `archivo` | File |

Respuesta: `{ message, documento: {...} }`

---

### `POST /api/docsueltos/carpetas/:carpeta_id/documentos/blanco`
Crea documento en blanco en carpeta (Word, Excel, PPT).

| Body | Tipo | Requerido |
|---|---|---|
| `nombreArchivo` | string | Si |
| `tipoPlantilla` | string | Si (`"word"`, `"excel"`, `"powerpoint"`) |

Respuesta: `{ message, documento: {...} }`

---

### `POST /api/docsueltos/documentos/:id/compartir`
Comparte documento suelto con otros usuarios.

| Body | Tipo |
|---|---|
| `usuarios_ids` | number[] |

Respuesta: `{ message }`

---

### `POST /api/docsueltos/documentos/:id/vincular-caso`
Copia documento suelto a un expediente (transaccion).

| Body | Tipo |
|---|---|
| `caso_id` | number |
| `tipo_documento_id` | number |

Respuesta: `{ message }`

---

### `DELETE /api/docsueltos/documentos/:id`
Soft-delete de documento suelto (`estado_doc = false`).

Respuesta: `{ message }`

---

### `GET /api/docsueltos/descargar?ruta={path}`
Descarga archivo por ruta absoluta. **Publico.**

---

### `GET /api/docsueltos/files/:fileId`
WOPI CheckFileInfo para documentos sueltos. **Publico.**

---

### `GET /api/docsueltos/files/:fileId/contents`
WOPI GetFile para documentos sueltos. **Publico.**

---

### `POST /api/docsueltos/files/:fileId/contents`
WOPI PutFile para documentos sueltos. **Publico.**

---

## `/wopi` — Collabora Online (documentos de casos)

### `GET /wopi/files/:fileId`
WOPI CheckFileInfo. **Publico.**

Respuesta: `{ BaseFileName, Size, UserId, UserCanWrite, PostMessageOrigin }`

---

### `GET /wopi/files/:fileId/contents`
WOPI GetFile (descarga binarios). **Publico.**

---

### `POST /wopi/files/:fileId/contents`
WOPI PutFile (guarda cambios). **Publico.** Body raw (Content-Type: `*/*`, limit 50MB).

---

## `/api/catalogos` — CRUD dinamico de catalogos

Catalogo disponibles: `tipos-evento`, `roles`, `grados`, `categorias-cliente`, `area-legal`.

Para `tipos-evento`, los campos validos son: `nombre` (string), `activo` (boolean), `color` (string, ej. `"#FF5733"`).

### `GET /api/catalogos/:catalogo`
Lista todos los registros del catalogo.

### `POST /api/catalogos/:catalogo`
Crea nuevo registro. Body: `{ columna1: valor, columna2: valor, ... }`

### `PUT /api/catalogos/:catalogo/:id`
Actualiza registro. Body: `{ columna1: valor, ... }`

### `DELETE /api/catalogos/:catalogo/:id`
Soft-delete (`activo = false`).

### `PUT /api/catalogos/:catalogo/:id/activar`
Reactiva registro (`activo = true`).

---

## Estados de referencia

### `estados_caso`
| id | nombre |
|---|---|
| 1 | Activo |
| 2 | En Espera |
| 3 | Cerrado |

### `estado_revision`
| id | descripcion |
|---|---|
| 1 | Pendiente |
| 2 | Aprobado |
| 3 | Con Observaciones |
| 4 | En Revisión |
| 5 | Revisado |
| 6 | Sin revisión (default) |
| 7 | Cerrado |

### `roles_usuario`
| id | nombre |
|---|---|
| 1 | Admin/Socio (ve todo) |
| 2-5 | Otros roles |

### `estados_usuario`
| id | nombre |
|---|---|
| 1 | Activo |
| 2 | Inactivo |
