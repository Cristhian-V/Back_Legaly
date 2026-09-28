-- ============================================================================
-- Actualización de base de datos - Legaly
-- Fecha: 2026-09-28
--
-- Cambios incluidos:
--   1) cites-correlativo
--      - Tabla cites_correlativos (contador anual del correlativo de CITES)
--      - Tabla cites (registro de correspondencia oficial)
--      - Semilla en tipos_historial_caso: 'creacion_cite'
--      - Semilla en tipo_documento: 'CITE'
--   2) tipos-evento-por-usuario
--      - Columna tipos_evento_cal.creado_por_id (autor del tipo; NULL = global)
--
-- Forma de uso (en el servidor):
--   psql -h <host> -p <puerto> -U <usuario> -d <base_de_datos> \
--        -v ON_ERROR_STOP=1 -f actualizacion_bd_cites_y_tipos_evento.sql
--
-- Es IDEMPOTENTE: puede ejecutarse varias veces sin generar errores.
-- Ejecutar ANTES de desplegar el código nuevo.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) CITES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cites_correlativos (
    anio integer PRIMARY KEY,
    ultimo integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cites (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero integer NOT NULL,
    anio integer NOT NULL,
    via character varying(20) NOT NULL,
    ref text,
    destinatario character varying(255),
    cargo_institucion character varying(255),
    creado_por_id integer REFERENCES usuarios(id) ON DELETE SET NULL,
    caso_id integer REFERENCES casos(caso_id) ON DELETE SET NULL,
    documento_id integer REFERENCES documentos(id) ON DELETE SET NULL,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cites_via_check CHECK (via IN ('correo', 'entrega física')),
    CONSTRAINT cites_anio_numero_key UNIQUE (anio, numero)
);

INSERT INTO tipos_historial_caso (codigo, nombre)
SELECT 'creacion_cite', 'Creación de CITE'
WHERE NOT EXISTS (SELECT 1 FROM tipos_historial_caso WHERE codigo = 'creacion_cite');

INSERT INTO tipo_documento (nombre)
SELECT 'CITE'
WHERE NOT EXISTS (SELECT 1 FROM tipo_documento WHERE nombre = 'CITE');

-- ----------------------------------------------------------------------------
-- 2) Tipos de evento por usuario
-- ----------------------------------------------------------------------------
ALTER TABLE tipos_evento_cal
    ADD COLUMN IF NOT EXISTS creado_por_id integer REFERENCES usuarios(id) ON DELETE SET NULL;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN: todas las filas deben salir en TRUE.
-- ============================================================================
SELECT 'tabla cites' AS objeto, to_regclass('public.cites') IS NOT NULL AS ok
UNION ALL
SELECT 'tabla cites_correlativos', to_regclass('public.cites_correlativos') IS NOT NULL
UNION ALL
SELECT 'columna tipos_evento_cal.creado_por_id',
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'tipos_evento_cal' AND column_name = 'creado_por_id')
UNION ALL
SELECT 'semilla tipos_historial_caso.creacion_cite',
       EXISTS (SELECT 1 FROM tipos_historial_caso WHERE codigo = 'creacion_cite')
UNION ALL
SELECT 'semilla tipo_documento.CITE',
       EXISTS (SELECT 1 FROM tipo_documento WHERE nombre = 'CITE')
UNION ALL
SELECT 'unicidad cites (anio, numero)',
       EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE table_name = 'cites' AND constraint_name = 'cites_anio_numero_key');

-- ============================================================================
-- ROLLBACK (ejecutar solo si necesitas revertir el cambio)
-- ============================================================================
-- DROP TABLE IF EXISTS cites;
-- DROP TABLE IF EXISTS cites_correlativos;
-- ALTER TABLE tipos_evento_cal DROP COLUMN IF EXISTS creado_por_id;
-- DELETE FROM tipos_historial_caso WHERE codigo = 'creacion_cite';
-- DELETE FROM tipo_documento WHERE nombre = 'CITE';
