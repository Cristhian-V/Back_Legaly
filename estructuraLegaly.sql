--
-- PostgreSQL database dump
--

\restrict arklTEh2YEekgCnqc0qcg7Fy27wUgKPsf81MdPOi3pxccxaZacJhERvune1Bgdj

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.1

-- Started on 2026-04-07 16:43:17

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5131 (class 1262 OID 24577)
-- Name: legaly; Type: DATABASE; Schema: -; Owner: -
--

CREATE DATABASE legaly WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'Spanish_Bolivia.1252';


\unrestrict arklTEh2YEekgCnqc0qcg7Fy27wUgKPsf81MdPOi3pxccxaZacJhERvune1Bgdj
\connect legaly
\restrict arklTEh2YEekgCnqc0qcg7Fy27wUgKPsf81MdPOi3pxccxaZacJhERvune1Bgdj

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 241 (class 1259 OID 41069)
-- Name: area_legal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.area_legal (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    codigo character varying(10)
);


--
-- TOC entry 240 (class 1259 OID 41068)
-- Name: area_legal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.area_legal ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.area_legal_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 239 (class 1259 OID 41027)
-- Name: casos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.casos (
    caso_id integer NOT NULL,
    expediente_id character varying(50) NOT NULL,
    cliente_id integer,
    responsable_id integer,
    descripcion_corta character varying(255) NOT NULL,
    descripcion_completa text,
    area_legal_id integer,
    contraparte character varying(255),
    fecha_inicio date,
    fecha_cierre date,
    estado_id integer DEFAULT 1,
    sub_estado character varying(100),
    progreso_porcentaje integer DEFAULT 0,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT casos_progreso_porcentaje_check CHECK (((progreso_porcentaje >= 0) AND (progreso_porcentaje <= 100)))
);


--
-- TOC entry 238 (class 1259 OID 41026)
-- Name: casos_caso_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.casos ALTER COLUMN caso_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.casos_caso_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 224 (class 1259 OID 24601)
-- Name: categorias_cliente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categorias_cliente (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL
);


--
-- TOC entry 223 (class 1259 OID 24600)
-- Name: categorias_cliente_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categorias_cliente_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5132 (class 0 OID 0)
-- Dependencies: 223
-- Name: categorias_cliente_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categorias_cliente_id_seq OWNED BY public.categorias_cliente.id;


--
-- TOC entry 243 (class 1259 OID 41092)
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    id integer NOT NULL,
    nombre_completo character varying(255) NOT NULL,
    documento_identidad character varying(50),
    correo_electronico character varying(150),
    telefono character varying(50),
    direccion text,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    categoria_id integer
);


--
-- TOC entry 242 (class 1259 OID 41091)
-- Name: clientes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.clientes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.clientes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 252 (class 1259 OID 57484)
-- Name: documentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos (
    id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    url_archivo text,
    tipo_documento_id integer,
    caso_id integer,
    fecha_subida timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    subido_por_id integer,
    pesomb character varying(50)
);


--
-- TOC entry 251 (class 1259 OID 57483)
-- Name: documentos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.documentos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.documentos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 244 (class 1259 OID 49279)
-- Name: equipo_caso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipo_caso (
    caso_id integer NOT NULL,
    usuario_id integer NOT NULL
);


--
-- TOC entry 246 (class 1259 OID 49297)
-- Name: estado_revision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estado_revision (
    id integer NOT NULL,
    descripcion character varying(50) NOT NULL
);


--
-- TOC entry 245 (class 1259 OID 49296)
-- Name: estado_revision_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.estado_revision ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.estado_revision_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 226 (class 1259 OID 24612)
-- Name: estados_caso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estados_caso (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL
);


--
-- TOC entry 225 (class 1259 OID 24611)
-- Name: estados_caso_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.estados_caso_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5133 (class 0 OID 0)
-- Dependencies: 225
-- Name: estados_caso_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.estados_caso_id_seq OWNED BY public.estados_caso.id;


--
-- TOC entry 222 (class 1259 OID 24590)
-- Name: estados_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estados_usuario (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL
);


--
-- TOC entry 221 (class 1259 OID 24589)
-- Name: estados_usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.estados_usuario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5134 (class 0 OID 0)
-- Dependencies: 221
-- Name: estados_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.estados_usuario_id_seq OWNED BY public.estados_usuario.id;


--
-- TOC entry 231 (class 1259 OID 24733)
-- Name: eventos_calendario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eventos_calendario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    caso_id integer,
    titulo character varying(255) NOT NULL,
    fecha_hora timestamp without time zone NOT NULL,
    tipo_evento_id integer NOT NULL,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    descripcion character varying(500)
);


--
-- TOC entry 235 (class 1259 OID 32769)
-- Name: grados_academicos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grados_academicos (
    id integer NOT NULL,
    titulo character varying(50) NOT NULL,
    nombre text,
    activo boolean DEFAULT true
);


--
-- TOC entry 234 (class 1259 OID 32768)
-- Name: grados_academicos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.grados_academicos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5135 (class 0 OID 0)
-- Dependencies: 234
-- Name: grados_academicos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.grados_academicos_id_seq OWNED BY public.grados_academicos.id;


--
-- TOC entry 232 (class 1259 OID 24776)
-- Name: historial_caso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historial_caso (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    caso_id character varying(50),
    titulo character varying(255) NOT NULL,
    descripcion text,
    fecha_hito timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    tipo_icono character varying(50)
);


--
-- TOC entry 233 (class 1259 OID 24792)
-- Name: interacciones_ia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interacciones_ia (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id integer,
    rol_mensaje_id integer NOT NULL,
    contenido text NOT NULL,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 248 (class 1259 OID 49305)
-- Name: revisiones_caso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revisiones_caso (
    id integer NOT NULL,
    caso_id integer,
    solicitante_id integer,
    revisor_id integer,
    estado_revision_id integer DEFAULT 1,
    comentarios_solicitud text,
    comentarios_revisor text,
    fecha_envio timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_revision timestamp without time zone
);


--
-- TOC entry 247 (class 1259 OID 49304)
-- Name: revisiones_caso_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.revisiones_caso ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.revisiones_caso_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 230 (class 1259 OID 24634)
-- Name: roles_interaccion_ia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles_interaccion_ia (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL
);


--
-- TOC entry 229 (class 1259 OID 24633)
-- Name: roles_interaccion_ia_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_interaccion_ia_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5136 (class 0 OID 0)
-- Dependencies: 229
-- Name: roles_interaccion_ia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_interaccion_ia_id_seq OWNED BY public.roles_interaccion_ia.id;


--
-- TOC entry 220 (class 1259 OID 24579)
-- Name: roles_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles_usuario (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL
);


--
-- TOC entry 219 (class 1259 OID 24578)
-- Name: roles_usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_usuario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5137 (class 0 OID 0)
-- Dependencies: 219
-- Name: roles_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_usuario_id_seq OWNED BY public.roles_usuario.id;


--
-- TOC entry 250 (class 1259 OID 57458)
-- Name: tipo_documento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipo_documento (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL
);


--
-- TOC entry 249 (class 1259 OID 57457)
-- Name: tipo_documento_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.tipo_documento ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.tipo_documento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 228 (class 1259 OID 24623)
-- Name: tipos_evento_cal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipos_evento_cal (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL
);


--
-- TOC entry 227 (class 1259 OID 24622)
-- Name: tipos_evento_cal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tipos_evento_cal_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5138 (class 0 OID 0)
-- Dependencies: 227
-- Name: tipos_evento_cal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tipos_evento_cal_id_seq OWNED BY public.tipos_evento_cal.id;


--
-- TOC entry 237 (class 1259 OID 40961)
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    grado_id integer,
    nombre_completo character varying(255) NOT NULL,
    nombre_usuario character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    rol_id integer NOT NULL,
    estado_id integer DEFAULT 1,
    telefono character varying(50),
    biografia text,
    avatar_url character varying(500),
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 236 (class 1259 OID 40960)
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.usuarios ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.usuarios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 4843 (class 2604 OID 24604)
-- Name: categorias_cliente id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_cliente ALTER COLUMN id SET DEFAULT nextval('public.categorias_cliente_id_seq'::regclass);


--
-- TOC entry 4844 (class 2604 OID 24615)
-- Name: estados_caso id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estados_caso ALTER COLUMN id SET DEFAULT nextval('public.estados_caso_id_seq'::regclass);


--
-- TOC entry 4842 (class 2604 OID 24593)
-- Name: estados_usuario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estados_usuario ALTER COLUMN id SET DEFAULT nextval('public.estados_usuario_id_seq'::regclass);


--
-- TOC entry 4853 (class 2604 OID 32772)
-- Name: grados_academicos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grados_academicos ALTER COLUMN id SET DEFAULT nextval('public.grados_academicos_id_seq'::regclass);


--
-- TOC entry 4846 (class 2604 OID 24637)
-- Name: roles_interaccion_ia id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles_interaccion_ia ALTER COLUMN id SET DEFAULT nextval('public.roles_interaccion_ia_id_seq'::regclass);


--
-- TOC entry 4841 (class 2604 OID 24582)
-- Name: roles_usuario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles_usuario ALTER COLUMN id SET DEFAULT nextval('public.roles_usuario_id_seq'::regclass);


--
-- TOC entry 4845 (class 2604 OID 24626)
-- Name: tipos_evento_cal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_evento_cal ALTER COLUMN id SET DEFAULT nextval('public.tipos_evento_cal_id_seq'::regclass);


--
-- TOC entry 5114 (class 0 OID 41069)
-- Dependencies: 241
-- Data for Name: area_legal; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.area_legal (id, nombre, codigo) FROM stdin;
1	Propiedad Intelectual	PI
2	Derecho Societario	DS
3	Litigio	LIT
4	Relaciones al Exterior	REX
\.


--
-- TOC entry 5112 (class 0 OID 41027)
-- Dependencies: 239
-- Data for Name: casos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.casos (caso_id, expediente_id, cliente_id, responsable_id, descripcion_corta, descripcion_completa, area_legal_id, contraparte, fecha_inicio, fecha_cierre, estado_id, sub_estado, progreso_porcentaje, creado_en) FROM stdin;
6	EXP-2026-0006	1	1	caso ejemplo corto	caso ejemplo completo	1	\N	\N	\N	1	Activo	0	2026-03-31 13:46:22.162
7	EXP-2026-0007	1	1	caso ejemplo corto	caso ejemplo completo	1	\N	\N	\N	1	Activo	0	2026-03-31 13:47:38.055
8	EXP-2026-0008	1	5	caso ejemplo corto	caso ejemplo completo	1	\N	\N	\N	1	Activo	0	2026-03-31 13:49:50.829
9	EXP-2026-0009	1	5	Constitución de Empresa CUMBRE S.A.	CUMBRE S.A. está constituida bajo la figura de una Sociedad Anónima, lo que implica que su capital está representado por acciones y la responsabilidad de sus socios se limita al monto de sus aportes. La elección de esta forma jurídica proyecta una imagen de solidez y transparencia, ideal para interactuar con grandes empresas importadoras y entidades gubernamentales como la Aduana Nacional de Bolivia (ANB).	2	N/A	\N	\N	1	Activo	0	2026-04-06 13:37:09.772
10	EXP-2026-0010	1	3	demanda de construcción de CUMBRE S.A.	asdasdadasdasd\nasd\nas\nd\nsad\nsd\n\nds\n	3	Cristhian Vargas	\N	\N	1	Activo	0	2026-04-06 13:58:52.248
11	EXP-2026-0011	1	2	demanda de construcción de CUMBRE S.A. 22222	asdasda1231232313 12 312 1231231231231312 12312	3	N/A	\N	\N	1	Activo	0	2026-04-06 15:53:53.743
12	EXP-2026-0012	1	2	asdasd	asdxzcczxczxc	1	N/A	\N	\N	1	Activo	0	2026-04-06 16:25:14.09
\.


--
-- TOC entry 5097 (class 0 OID 24601)
-- Dependencies: 224
-- Data for Name: categorias_cliente; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categorias_cliente (id, nombre) FROM stdin;
1	PYME
2	Corporativo
3	Persona Natural
\.


--
-- TOC entry 5116 (class 0 OID 41092)
-- Dependencies: 243
-- Data for Name: clientes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clientes (id, nombre_completo, documento_identidad, correo_electronico, telefono, direccion, creado_en, categoria_id) FROM stdin;
1	Juan Pérez	12345678	juan.perez@email.com	+591 77712345	Av. Principal 123, Santa Cruz	2026-03-31 13:09:58.185873	1
\.


--
-- TOC entry 5125 (class 0 OID 57484)
-- Dependencies: 252
-- Data for Name: documentos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.documentos (id, nombre, url_archivo, tipo_documento_id, caso_id, fecha_subida, subido_por_id, pesomb) FROM stdin;
1	1A ORDEN CERRADO 2DA. PARTE.pdf	D:\\Cristhian Dev\\AlaizaPedraza\\Documentos\\1A ORDEN CERRADO 2DA. PARTE.pdf	3	8	2026-04-07 15:19:29.273	5	\N
2	Res.docx	D:\\Cristhian Dev\\AlaizaPedraza\\Documentos\\Res.docx	3	8	2026-04-07 15:20:02.214	5	\N
3	antiguo  ANTEPROYECTO_L_3058.pdf	D:\\Cristhian Dev\\AlaizaPedraza\\Documentos\\antiguo  ANTEPROYECTO_L_3058.pdf	4	8	2026-04-07 15:24:25.045	5	\N
4	reporte Det. Gastos 1.png	D:\\Cristhian Dev\\AlaizaPedraza\\Documentos\\reporte Det. Gastos 1.png	2	8	2026-04-07 15:41:02.044	5	\N
5	reporte Det. Gastos 2.png	D:\\Cristhian Dev\\AlaizaPedraza\\Documentos\\reporte Det. Gastos 2.png	3	8	2026-04-07 16:09:05.668	5	178337
6	DI-2026-201-2097687 CP-57980.pdf	D:\\Cristhian Dev\\AlaizaPedraza\\Documentos\\DI-2026-201-2097687 CP-57980.pdf	2	8	2026-04-07 16:11:07.887	5	0.07497119903564453
7	Gemini_Generated_Image_fv033efv033efv03.png	D:\\Cristhian Dev\\AlaizaPedraza\\Documentos\\Gemini_Generated_Image_fv033efv033efv03.png	3	9	2026-04-07 16:15:40.442	5	8.052
8	Gemini_Generated_Image_84ii4s84ii4s84ii.png	D:\\Cristhian Dev\\AlaizaPedraza\\Documentos\\Gemini_Generated_Image_84ii4s84ii4s84ii.png	2	9	2026-04-07 16:16:54.753	5	8
9	Gemini_Generated_Image_84ii4s84ii4s84ii.png	D:\\Cristhian Dev\\AlaizaPedraza\\Documentos\\2026\\EXP-2026-0010\\Gemini_Generated_Image_84ii4s84ii4s84ii.png	3	10	2026-04-07 16:27:26.484	3	8
10	reporte Det. Gastos 2.png	D:\\Cristhian Dev\\AlaizaPedraza\\Documentos\\2026\\EXP-2026-0010\\reporte Det. Gastos 2.png	1	10	2026-04-07 16:29:19.511	3	0
11	antiguo  ANTEPROYECTO_L_3058.pdf	D:\\Cristhian Dev\\AlaizaPedraza\\Documentos\\2026\\EXP-2026-0010\\antiguo  ANTEPROYECTO_L_3058.pdf	2	10	2026-04-07 16:30:16.654	3	0
\.


--
-- TOC entry 5117 (class 0 OID 49279)
-- Dependencies: 244
-- Data for Name: equipo_caso; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.equipo_caso (caso_id, usuario_id) FROM stdin;
\.


--
-- TOC entry 5119 (class 0 OID 49297)
-- Dependencies: 246
-- Data for Name: estado_revision; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.estado_revision (id, descripcion) FROM stdin;
1	Pendiente
2	Aprobado
3	Con Observaciones
4	En Revisión
5	Realizado
\.


--
-- TOC entry 5099 (class 0 OID 24612)
-- Dependencies: 226
-- Data for Name: estados_caso; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.estados_caso (id, nombre) FROM stdin;
1	Activo
2	En Espera
3	Cerrado
\.


--
-- TOC entry 5095 (class 0 OID 24590)
-- Dependencies: 222
-- Data for Name: estados_usuario; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.estados_usuario (id, nombre) FROM stdin;
1	Activo
2	Inactivo
\.


--
-- TOC entry 5104 (class 0 OID 24733)
-- Dependencies: 231
-- Data for Name: eventos_calendario; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.eventos_calendario (id, caso_id, titulo, fecha_hora, tipo_evento_id, creado_en, descripcion) FROM stdin;
\.


--
-- TOC entry 5108 (class 0 OID 32769)
-- Dependencies: 235
-- Data for Name: grados_academicos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.grados_academicos (id, titulo, nombre, activo) FROM stdin;
1	Dr.	Doctor	t
2	Dra.	Doctora	t
3	Msc.	Magíster	t
4	Lic.	Licenciado/a	t
5	Abg.	Abogado/a	t
6	Asistente	Personal de apoyo o asistente	t
\.


--
-- TOC entry 5105 (class 0 OID 24776)
-- Dependencies: 232
-- Data for Name: historial_caso; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.historial_caso (id, caso_id, titulo, descripcion, fecha_hito, tipo_icono) FROM stdin;
\.


--
-- TOC entry 5106 (class 0 OID 24792)
-- Dependencies: 233
-- Data for Name: interacciones_ia; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.interacciones_ia (id, usuario_id, rol_mensaje_id, contenido, creado_en) FROM stdin;
\.


--
-- TOC entry 5121 (class 0 OID 49305)
-- Dependencies: 248
-- Data for Name: revisiones_caso; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.revisiones_caso (id, caso_id, solicitante_id, revisor_id, estado_revision_id, comentarios_solicitud, comentarios_revisor, fecha_envio, fecha_revision) FROM stdin;
\.


--
-- TOC entry 5103 (class 0 OID 24634)
-- Dependencies: 230
-- Data for Name: roles_interaccion_ia; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles_interaccion_ia (id, nombre) FROM stdin;
1	user
2	model
\.


--
-- TOC entry 5093 (class 0 OID 24579)
-- Dependencies: 220
-- Data for Name: roles_usuario; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles_usuario (id, nombre) FROM stdin;
1	Abogado Socio
2	Abogado Asociado
3	Abogado
4	Asistente Legal
5	Pasante
\.


--
-- TOC entry 5123 (class 0 OID 57458)
-- Dependencies: 250
-- Data for Name: tipo_documento; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tipo_documento (id, nombre) FROM stdin;
1	Cédula de Identidad
2	Pasaporte
3	NIT
4	RUN
\.


--
-- TOC entry 5101 (class 0 OID 24623)
-- Dependencies: 228
-- Data for Name: tipos_evento_cal; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tipos_evento_cal (id, nombre) FROM stdin;
1	audiencia
2	plazo
3	reunion
4	doc
\.


--
-- TOC entry 5110 (class 0 OID 40961)
-- Dependencies: 237
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.usuarios (id, grado_id, nombre_completo, nombre_usuario, email, password_hash, rol_id, estado_id, telefono, biografia, avatar_url, creado_en) FROM stdin;
2	1	Cristhian Sergio Vargas Flores	cristhian.vargas	cristhian.vargas@cumbre.com.bo	$2b$10$CFxj6daFH2JXju6sOqlc3.3I.m2XU82EThEEX1YH3zwIgLeKR./0C	5	1	69283022	SOY YOOOOOO		2026-03-24 10:27:16.478
5	5	Angela Ivanna Alizarez Revollo	a	angela@cumbre.com.bo	$2b$10$oQdZRhVzvCCsCSKg6FP1Lewc8CFk9kxdgvCTTE9osKmcft8wlcnKS	5	1	69283022	Analista de operaciones		2026-03-24 14:12:34.237
1	2	Blanca Sofia Alaiza	blanca.alaiza	blanca.alaiza@alaizapedraza.com	$2b$10$Nn/MFL07uriCmmfsLWy.zuUd9f0UAABQE5yXEFWCd28S8BGSyedEG	1	1	69283022	Abogada Senior con espesialidad en corporaciones		2026-03-24 10:24:58.486
3	2	Laura Pedraza	laura.pedraza	laura.pedraza@alaizaPedraza.com	$2b$10$hAJP4vFAjiTjkN3fzOCsKuYIDmNGyDsFQA2gzE9nZQeTAwwojYYHO	4	1				2026-03-24 10:27:56.444
\.


--
-- TOC entry 5139 (class 0 OID 0)
-- Dependencies: 240
-- Name: area_legal_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.area_legal_id_seq', 4, true);


--
-- TOC entry 5140 (class 0 OID 0)
-- Dependencies: 238
-- Name: casos_caso_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.casos_caso_id_seq', 12, true);


--
-- TOC entry 5141 (class 0 OID 0)
-- Dependencies: 223
-- Name: categorias_cliente_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categorias_cliente_id_seq', 3, true);


--
-- TOC entry 5142 (class 0 OID 0)
-- Dependencies: 242
-- Name: clientes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.clientes_id_seq', 1, true);


--
-- TOC entry 5143 (class 0 OID 0)
-- Dependencies: 251
-- Name: documentos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.documentos_id_seq', 11, true);


--
-- TOC entry 5144 (class 0 OID 0)
-- Dependencies: 245
-- Name: estado_revision_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.estado_revision_id_seq', 5, true);


--
-- TOC entry 5145 (class 0 OID 0)
-- Dependencies: 225
-- Name: estados_caso_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.estados_caso_id_seq', 3, true);


--
-- TOC entry 5146 (class 0 OID 0)
-- Dependencies: 221
-- Name: estados_usuario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.estados_usuario_id_seq', 2, true);


--
-- TOC entry 5147 (class 0 OID 0)
-- Dependencies: 234
-- Name: grados_academicos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.grados_academicos_id_seq', 6, true);


--
-- TOC entry 5148 (class 0 OID 0)
-- Dependencies: 247
-- Name: revisiones_caso_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.revisiones_caso_id_seq', 1, false);


--
-- TOC entry 5149 (class 0 OID 0)
-- Dependencies: 229
-- Name: roles_interaccion_ia_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roles_interaccion_ia_id_seq', 2, true);


--
-- TOC entry 5150 (class 0 OID 0)
-- Dependencies: 219
-- Name: roles_usuario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roles_usuario_id_seq', 5, true);


--
-- TOC entry 5151 (class 0 OID 0)
-- Dependencies: 249
-- Name: tipo_documento_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tipo_documento_id_seq', 4, true);


--
-- TOC entry 5152 (class 0 OID 0)
-- Dependencies: 227
-- Name: tipos_evento_cal_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tipos_evento_cal_id_seq', 4, true);


--
-- TOC entry 5153 (class 0 OID 0)
-- Dependencies: 236
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 5, true);


--
-- TOC entry 4913 (class 2606 OID 41075)
-- Name: area_legal area_legal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.area_legal
    ADD CONSTRAINT area_legal_pkey PRIMARY KEY (id);


--
-- TOC entry 4906 (class 2606 OID 41042)
-- Name: casos casos_expediente_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.casos
    ADD CONSTRAINT casos_expediente_id_key UNIQUE (expediente_id);


--
-- TOC entry 4908 (class 2606 OID 41040)
-- Name: casos casos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.casos
    ADD CONSTRAINT casos_pkey PRIMARY KEY (caso_id);


--
-- TOC entry 4874 (class 2606 OID 24610)
-- Name: categorias_cliente categorias_cliente_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_cliente
    ADD CONSTRAINT categorias_cliente_nombre_key UNIQUE (nombre);


--
-- TOC entry 4876 (class 2606 OID 24608)
-- Name: categorias_cliente categorias_cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_cliente
    ADD CONSTRAINT categorias_cliente_pkey PRIMARY KEY (id);


--
-- TOC entry 4915 (class 2606 OID 41101)
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- TOC entry 4927 (class 2606 OID 57493)
-- Name: documentos documentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT documentos_pkey PRIMARY KEY (id);


--
-- TOC entry 4917 (class 2606 OID 49285)
-- Name: equipo_caso equipo_caso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipo_caso
    ADD CONSTRAINT equipo_caso_pkey PRIMARY KEY (caso_id, usuario_id);


--
-- TOC entry 4919 (class 2606 OID 49303)
-- Name: estado_revision estado_revision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estado_revision
    ADD CONSTRAINT estado_revision_pkey PRIMARY KEY (id);


--
-- TOC entry 4878 (class 2606 OID 24621)
-- Name: estados_caso estados_caso_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estados_caso
    ADD CONSTRAINT estados_caso_nombre_key UNIQUE (nombre);


--
-- TOC entry 4880 (class 2606 OID 24619)
-- Name: estados_caso estados_caso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estados_caso
    ADD CONSTRAINT estados_caso_pkey PRIMARY KEY (id);


--
-- TOC entry 4870 (class 2606 OID 24599)
-- Name: estados_usuario estados_usuario_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estados_usuario
    ADD CONSTRAINT estados_usuario_nombre_key UNIQUE (nombre);


--
-- TOC entry 4872 (class 2606 OID 24597)
-- Name: estados_usuario estados_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estados_usuario
    ADD CONSTRAINT estados_usuario_pkey PRIMARY KEY (id);


--
-- TOC entry 4890 (class 2606 OID 24743)
-- Name: eventos_calendario eventos_calendario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_calendario
    ADD CONSTRAINT eventos_calendario_pkey PRIMARY KEY (id);


--
-- TOC entry 4898 (class 2606 OID 32779)
-- Name: grados_academicos grados_academicos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grados_academicos
    ADD CONSTRAINT grados_academicos_pkey PRIMARY KEY (id);


--
-- TOC entry 4900 (class 2606 OID 32781)
-- Name: grados_academicos grados_academicos_titulo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grados_academicos
    ADD CONSTRAINT grados_academicos_titulo_key UNIQUE (titulo);


--
-- TOC entry 4893 (class 2606 OID 24786)
-- Name: historial_caso historial_caso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_caso
    ADD CONSTRAINT historial_caso_pkey PRIMARY KEY (id);


--
-- TOC entry 4896 (class 2606 OID 24803)
-- Name: interacciones_ia interacciones_ia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interacciones_ia
    ADD CONSTRAINT interacciones_ia_pkey PRIMARY KEY (id);


--
-- TOC entry 4921 (class 2606 OID 49314)
-- Name: revisiones_caso revisiones_caso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_caso
    ADD CONSTRAINT revisiones_caso_pkey PRIMARY KEY (id);


--
-- TOC entry 4886 (class 2606 OID 24643)
-- Name: roles_interaccion_ia roles_interaccion_ia_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles_interaccion_ia
    ADD CONSTRAINT roles_interaccion_ia_nombre_key UNIQUE (nombre);


--
-- TOC entry 4888 (class 2606 OID 24641)
-- Name: roles_interaccion_ia roles_interaccion_ia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles_interaccion_ia
    ADD CONSTRAINT roles_interaccion_ia_pkey PRIMARY KEY (id);


--
-- TOC entry 4866 (class 2606 OID 24588)
-- Name: roles_usuario roles_usuario_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles_usuario
    ADD CONSTRAINT roles_usuario_nombre_key UNIQUE (nombre);


--
-- TOC entry 4868 (class 2606 OID 24586)
-- Name: roles_usuario roles_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles_usuario
    ADD CONSTRAINT roles_usuario_pkey PRIMARY KEY (id);


--
-- TOC entry 4923 (class 2606 OID 57466)
-- Name: tipo_documento tipo_documento_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipo_documento
    ADD CONSTRAINT tipo_documento_nombre_key UNIQUE (nombre);


--
-- TOC entry 4925 (class 2606 OID 57464)
-- Name: tipo_documento tipo_documento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipo_documento
    ADD CONSTRAINT tipo_documento_pkey PRIMARY KEY (id);


--
-- TOC entry 4882 (class 2606 OID 24632)
-- Name: tipos_evento_cal tipos_evento_cal_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_evento_cal
    ADD CONSTRAINT tipos_evento_cal_nombre_key UNIQUE (nombre);


--
-- TOC entry 4884 (class 2606 OID 24630)
-- Name: tipos_evento_cal tipos_evento_cal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_evento_cal
    ADD CONSTRAINT tipos_evento_cal_pkey PRIMARY KEY (id);


--
-- TOC entry 4902 (class 2606 OID 40977)
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- TOC entry 4904 (class 2606 OID 40975)
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- TOC entry 4909 (class 1259 OID 41102)
-- Name: idx_casos_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_casos_cliente ON public.casos USING btree (cliente_id) WITH (fillfactor='100', deduplicate_items='true');


--
-- TOC entry 4910 (class 1259 OID 41054)
-- Name: idx_casos_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_casos_estado ON public.casos USING btree (estado_id) WITH (fillfactor='100', deduplicate_items='true');


--
-- TOC entry 4911 (class 1259 OID 41055)
-- Name: idx_casos_responsable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_casos_responsable ON public.casos USING btree (responsable_id) WITH (fillfactor='100', deduplicate_items='true');


--
-- TOC entry 4891 (class 1259 OID 24817)
-- Name: idx_eventos_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eventos_fecha ON public.eventos_calendario USING btree (fecha_hora);


--
-- TOC entry 4894 (class 1259 OID 41001)
-- Name: idx_interacciones_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interacciones_usuario ON public.interacciones_ia USING btree (usuario_id);


--
-- TOC entry 4934 (class 2606 OID 41113)
-- Name: casos casos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.casos
    ADD CONSTRAINT casos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE RESTRICT;


--
-- TOC entry 4935 (class 2606 OID 41048)
-- Name: casos casos_estado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.casos
    ADD CONSTRAINT casos_estado_id_fkey FOREIGN KEY (estado_id) REFERENCES public.estados_caso(id) ON DELETE RESTRICT;


--
-- TOC entry 4938 (class 2606 OID 49286)
-- Name: equipo_caso equipo_caso_caso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipo_caso
    ADD CONSTRAINT equipo_caso_caso_id_fkey FOREIGN KEY (caso_id) REFERENCES public.casos(caso_id);


--
-- TOC entry 4939 (class 2606 OID 49291)
-- Name: equipo_caso equipo_caso_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipo_caso
    ADD CONSTRAINT equipo_caso_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 4928 (class 2606 OID 24749)
-- Name: eventos_calendario eventos_calendario_tipo_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_calendario
    ADD CONSTRAINT eventos_calendario_tipo_evento_id_fkey FOREIGN KEY (tipo_evento_id) REFERENCES public.tipos_evento_cal(id) ON DELETE RESTRICT;


--
-- TOC entry 4936 (class 2606 OID 41086)
-- Name: casos fk_casos_area_legal; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.casos
    ADD CONSTRAINT fk_casos_area_legal FOREIGN KEY (area_legal_id) REFERENCES public.area_legal(id) ON DELETE SET NULL;


--
-- TOC entry 4937 (class 2606 OID 57452)
-- Name: clientes fk_clientes_categoria; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT fk_clientes_categoria FOREIGN KEY (categoria_id) REFERENCES public.categorias_cliente(id) ON DELETE SET NULL;


--
-- TOC entry 4944 (class 2606 OID 57494)
-- Name: documentos fk_documentos_caso; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT fk_documentos_caso FOREIGN KEY (caso_id) REFERENCES public.casos(caso_id) ON DELETE CASCADE;


--
-- TOC entry 4929 (class 2606 OID 41063)
-- Name: eventos_calendario fk_eventos_casos; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_calendario
    ADD CONSTRAINT fk_eventos_casos FOREIGN KEY (caso_id) REFERENCES public.casos(caso_id) ON DELETE CASCADE;


--
-- TOC entry 4930 (class 2606 OID 24809)
-- Name: interacciones_ia interacciones_ia_rol_mensaje_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interacciones_ia
    ADD CONSTRAINT interacciones_ia_rol_mensaje_id_fkey FOREIGN KEY (rol_mensaje_id) REFERENCES public.roles_interaccion_ia(id) ON DELETE RESTRICT;


--
-- TOC entry 4940 (class 2606 OID 49315)
-- Name: revisiones_caso revisiones_caso_caso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_caso
    ADD CONSTRAINT revisiones_caso_caso_id_fkey FOREIGN KEY (caso_id) REFERENCES public.casos(caso_id) ON DELETE CASCADE;


--
-- TOC entry 4941 (class 2606 OID 49330)
-- Name: revisiones_caso revisiones_caso_estado_revision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_caso
    ADD CONSTRAINT revisiones_caso_estado_revision_id_fkey FOREIGN KEY (estado_revision_id) REFERENCES public.estado_revision(id) ON DELETE RESTRICT;


--
-- TOC entry 4942 (class 2606 OID 49325)
-- Name: revisiones_caso revisiones_caso_revisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_caso
    ADD CONSTRAINT revisiones_caso_revisor_id_fkey FOREIGN KEY (revisor_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- TOC entry 4943 (class 2606 OID 49320)
-- Name: revisiones_caso revisiones_caso_solicitante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisiones_caso
    ADD CONSTRAINT revisiones_caso_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- TOC entry 4931 (class 2606 OID 41019)
-- Name: usuarios usuarios_estado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_estado_id_fkey FOREIGN KEY (estado_id) REFERENCES public.estados_usuario(id) ON DELETE RESTRICT;


--
-- TOC entry 4932 (class 2606 OID 41009)
-- Name: usuarios usuarios_grado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_grado_id_fkey FOREIGN KEY (grado_id) REFERENCES public.grados_academicos(id) ON DELETE SET NULL;


--
-- TOC entry 4933 (class 2606 OID 41014)
-- Name: usuarios usuarios_rol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles_usuario(id) ON DELETE RESTRICT;


-- Completed on 2026-04-07 16:43:17

--
-- PostgreSQL database dump complete
--

\unrestrict arklTEh2YEekgCnqc0qcg7Fy27wUgKPsf81MdPOi3pxccxaZacJhERvune1Bgdj

