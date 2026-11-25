-- Schema baseline (VER-10, D3).
--
-- This file is the current schema as one migration. It replaces the retired
-- 001-011 chain; the runner records version 1 and skips it on every later run.
-- Existing databases that already recorded versions 1-11 keep their rows and
-- adopt this file by skipping it. Adoption is non-destructive: no DROP, DELETE
-- or TRUNCATE. Never edit an applied baseline; add a new numbered migration.

--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE assets (
    id uuid NOT NULL,
    project_id text NOT NULL,
    name text NOT NULL,
    kind text NOT NULL,
    storage_kind text NOT NULL,
    source_kind text NOT NULL,
    source_ref text,
    mime text,
    byte_size bigint,
    sha256 text,
    object_key text,
    import_state text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT assets_byte_size_check CHECK (((byte_size >= 1) AND (byte_size <= 26214400))),
    CONSTRAINT assets_check CHECK ((((storage_kind = 'r2'::text) AND (object_key IS NOT NULL) AND (source_kind = 'upload'::text)) OR ((storage_kind = 'none'::text) AND (object_key IS NULL) AND (source_kind = ANY (ARRAY['builtin'::text, 'procedural'::text]))))),
    CONSTRAINT assets_check1 CHECK (((storage_kind = 'r2'::text) OR (import_state = 'ready'::text))),
    CONSTRAINT assets_check2 CHECK (((import_state <> 'ready'::text) OR (storage_kind = 'none'::text) OR ((mime IS NOT NULL) AND (byte_size IS NOT NULL) AND (sha256 IS NOT NULL)))),
    CONSTRAINT assets_import_state_check CHECK ((import_state = ANY (ARRAY['pending'::text, 'ready'::text, 'failed'::text]))),
    CONSTRAINT assets_kind_check CHECK ((kind = ANY (ARRAY['texture'::text, 'procedural'::text]))),
    CONSTRAINT assets_mime_check CHECK ((mime = ANY (ARRAY['image/png'::text, 'image/webp'::text, 'image/jpeg'::text]))),
    CONSTRAINT assets_name_check CHECK ((((char_length(name) >= 1) AND (char_length(name) <= 128)) AND (name = btrim(name)) AND (POSITION(('/'::text) IN (name)) = 0) AND (POSITION((chr(92)) IN (name)) = 0))),
    CONSTRAINT assets_sha256_check CHECK ((sha256 ~ '^sha256-[0-9a-f]{64}$'::text)),
    CONSTRAINT assets_source_kind_check CHECK ((source_kind = ANY (ARRAY['upload'::text, 'builtin'::text, 'procedural'::text]))),
    CONSTRAINT assets_storage_kind_check CHECK ((storage_kind = ANY (ARRAY['r2'::text, 'none'::text])))
);


--
-- Name: auth_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE auth_attempts (
    key text NOT NULL,
    attempts integer NOT NULL,
    window_start timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT auth_attempts_attempts_check CHECK ((attempts > 0))
);


--
-- Name: form_library_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE form_library_items (
    id uuid NOT NULL,
    owner_id text NOT NULL,
    kind text NOT NULL,
    name text NOT NULL,
    format_version integer NOT NULL,
    content_id text NOT NULL,
    canonical_bytes bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    recipe_hash text,
    thumbnail_key text,
    thumbnail_hash text,
    thumbnail_recipe_key text,
    thumbnail_byte_size bigint,
    CONSTRAINT form_library_items_canonical_bytes_check CHECK (((octet_length(canonical_bytes) >= 1) AND (octet_length(canonical_bytes) <= 262144))),
    CONSTRAINT form_library_items_content_id_check CHECK ((content_id ~ '^sha256-[0-9a-f]{64}$'::text)),
    CONSTRAINT form_library_items_format_version_check CHECK ((format_version > 0)),
    CONSTRAINT form_library_items_kind_check CHECK ((kind = ANY (ARRAY['form'::text, 'material'::text]))),
    CONSTRAINT form_library_items_material_fields_check CHECK ((((kind = 'material'::text) AND (recipe_hash IS NOT NULL)) OR ((kind = 'form'::text) AND (recipe_hash IS NULL) AND (thumbnail_key IS NULL) AND (thumbnail_hash IS NULL) AND (thumbnail_recipe_key IS NULL) AND (thumbnail_byte_size IS NULL)))),
    CONSTRAINT form_library_items_name_check CHECK ((((char_length(name) >= 1) AND (char_length(name) <= 120)) AND (name = btrim(name)))),
    CONSTRAINT form_library_items_recipe_hash_check CHECK (((recipe_hash IS NULL) OR (recipe_hash ~ '^sha256-[0-9a-f]{64}$'::text))),
    CONSTRAINT form_library_items_thumbnail_byte_size_check CHECK (((thumbnail_byte_size IS NULL) OR ((thumbnail_byte_size >= 1) AND (thumbnail_byte_size <= 262144)))),
    CONSTRAINT form_library_items_thumbnail_complete_check CHECK ((((thumbnail_key IS NULL) AND (thumbnail_hash IS NULL) AND (thumbnail_recipe_key IS NULL) AND (thumbnail_byte_size IS NULL)) OR ((thumbnail_key IS NOT NULL) AND (thumbnail_hash IS NOT NULL) AND (thumbnail_recipe_key IS NOT NULL) AND (thumbnail_byte_size IS NOT NULL)))),
    CONSTRAINT form_library_items_thumbnail_hash_check CHECK (((thumbnail_hash IS NULL) OR (thumbnail_hash ~ '^sha256-[0-9a-f]{64}$'::text))),
    CONSTRAINT form_library_items_thumbnail_key_check CHECK (((thumbnail_key IS NULL) OR (((char_length(thumbnail_key) >= 1) AND (char_length(thumbnail_key) <= 1024)) AND (thumbnail_key = btrim(thumbnail_key))))),
    CONSTRAINT form_library_items_thumbnail_recipe_key_check CHECK (((thumbnail_recipe_key IS NULL) OR (thumbnail_recipe_key ~ '^sha256-[0-9a-f]{64}$'::text)))
);


--
-- Name: image_repair_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE image_repair_attempts (
    id uuid NOT NULL,
    project_id text NOT NULL,
    owner_id text NOT NULL,
    asset_id uuid NOT NULL,
    expected_pin text NOT NULL,
    saved_base_token text NOT NULL,
    staging_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT image_repair_attempts_check CHECK ((expires_at > created_at)),
    CONSTRAINT image_repair_attempts_expected_pin_check CHECK ((expected_pin ~ '^sha256-[0-9a-f]{64}$'::text)),
    CONSTRAINT image_repair_attempts_saved_base_token_check CHECK ((saved_base_token ~~ 'saved-base:%'::text)),
    CONSTRAINT image_repair_attempts_staging_key_check CHECK ((((char_length(staging_key) >= 1) AND (char_length(staging_key) <= 1024)) AND (staging_key = btrim(staging_key))))
);


--
-- Name: library_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE library_receipts (
    owner_id text NOT NULL,
    operation_kind text NOT NULL,
    operation_id text NOT NULL,
    request_digest text NOT NULL,
    destination_saved_base text,
    response jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT library_receipts_operation_id_check CHECK (((char_length(operation_id) >= 1) AND (char_length(operation_id) <= 128))),
    CONSTRAINT library_receipts_operation_kind_check CHECK ((operation_kind = ANY (ARRAY['material-save'::text, 'material-transfer'::text]))),
    CONSTRAINT library_receipts_request_digest_check CHECK ((request_digest ~ '^sha256-[0-9a-f]{64}$'::text))
);


--
-- Name: library_staging; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE library_staging (
    id uuid NOT NULL,
    owner_id text NOT NULL,
    object_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT library_staging_check CHECK ((expires_at > created_at)),
    CONSTRAINT library_staging_object_key_check CHECK ((((char_length(object_key) >= 1) AND (char_length(object_key) <= 1024)) AND (object_key = btrim(object_key))))
);


--
-- Name: local_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE local_credentials (
    user_id text NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT local_credentials_username_check CHECK ((username ~ '^[a-z0-9_.-]{3,32}$'::text))
);


--
-- Name: material_library_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE material_library_images (
    item_id uuid NOT NULL,
    hash text NOT NULL,
    mime text NOT NULL,
    byte_size bigint NOT NULL,
    source_kind text NOT NULL,
    object_key text,
    source_uri text,
    CONSTRAINT material_library_images_byte_size_check CHECK (((byte_size >= 1) AND (byte_size <= 26214400))),
    CONSTRAINT material_library_images_check CHECK ((((source_kind = 'object'::text) AND (object_key IS NOT NULL) AND (source_uri IS NULL)) OR ((source_kind = 'shipped'::text) AND (object_key IS NULL) AND (source_uri IS NOT NULL)))),
    CONSTRAINT material_library_images_hash_check CHECK ((hash ~ '^sha256-[0-9a-f]{64}$'::text)),
    CONSTRAINT material_library_images_mime_check CHECK ((mime = ANY (ARRAY['image/png'::text, 'image/jpeg'::text, 'image/webp'::text]))),
    CONSTRAINT material_library_images_source_kind_check CHECK ((source_kind = ANY (ARRAY['object'::text, 'shipped'::text])))
);


--
-- Name: model_import_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE model_import_files (
    import_id uuid NOT NULL,
    file_id uuid NOT NULL,
    role text NOT NULL,
    path text NOT NULL,
    byte_size bigint NOT NULL,
    sha256 text NOT NULL,
    object_key text,
    upload_state text NOT NULL,
    uploaded_at timestamp with time zone,
    CONSTRAINT model_import_files_byte_size_check CHECK (((byte_size >= 1) AND (byte_size <= 52428800))),
    CONSTRAINT model_import_files_check CHECK ((((upload_state = 'uploaded'::text) AND (object_key IS NOT NULL) AND (uploaded_at IS NOT NULL)) OR ((upload_state = 'uploading'::text) AND (object_key IS NOT NULL) AND (uploaded_at IS NULL)) OR ((upload_state = ANY (ARRAY['declared'::text, 'failed'::text])) AND (object_key IS NULL)))),
    CONSTRAINT model_import_files_path_check CHECK ((((char_length(path) >= 1) AND (char_length(path) <= 256)) AND (path ~ '^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$'::text) AND (path !~~ '%..%'::text))),
    CONSTRAINT model_import_files_role_check CHECK ((role = ANY (ARRAY['source'::text, 'derivative'::text]))),
    CONSTRAINT model_import_files_sha256_check CHECK ((sha256 ~ '^sha256-[0-9a-f]{64}$'::text)),
    CONSTRAINT model_import_files_upload_state_check CHECK ((upload_state = ANY (ARRAY['declared'::text, 'uploading'::text, 'uploaded'::text, 'failed'::text])))
);


--
-- Name: model_imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE model_imports (
    id uuid NOT NULL,
    project_id text NOT NULL,
    owner_id text NOT NULL,
    recipe_id text NOT NULL,
    recipe_version integer NOT NULL,
    source_manifest_hash text NOT NULL,
    source_bytes bigint NOT NULL,
    derivative_bytes bigint NOT NULL,
    state text NOT NULL,
    revision_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT model_imports_check CHECK ((expires_at > created_at)),
    CONSTRAINT model_imports_derivative_bytes_check CHECK (((derivative_bytes >= 1) AND (derivative_bytes <= 26214400))),
    CONSTRAINT model_imports_recipe_id_check CHECK ((((char_length(recipe_id) >= 1) AND (char_length(recipe_id) <= 128)) AND (recipe_id = btrim(recipe_id)))),
    CONSTRAINT model_imports_recipe_version_check CHECK ((recipe_version > 0)),
    CONSTRAINT model_imports_source_bytes_check CHECK (((source_bytes >= 1) AND (source_bytes <= 52428800))),
    CONSTRAINT model_imports_source_manifest_hash_check CHECK ((source_manifest_hash ~ '^sha256-[0-9a-f]{64}$'::text)),
    CONSTRAINT model_imports_state_check CHECK ((state = ANY (ARRAY['staging'::text, 'approved'::text, 'cancelled'::text, 'expired'::text])))
);


--
-- Name: model_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE model_revisions (
    id uuid NOT NULL,
    project_id text NOT NULL,
    content_hash text NOT NULL,
    derivative_hash text NOT NULL,
    derivative_mime text NOT NULL,
    derivative_bytes bigint NOT NULL,
    derivative_key text NOT NULL,
    source_manifest_hash text NOT NULL,
    source_bytes bigint NOT NULL,
    source_file_count integer NOT NULL,
    recipe_id text NOT NULL,
    recipe_version integer NOT NULL,
    report_digest text NOT NULL,
    placement jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source_keys jsonb,
    CONSTRAINT model_revisions_content_hash_check CHECK ((content_hash ~ '^sha256-[0-9a-f]{64}$'::text)),
    CONSTRAINT model_revisions_derivative_bytes_check CHECK (((derivative_bytes >= 1) AND (derivative_bytes <= 26214400))),
    CONSTRAINT model_revisions_derivative_hash_check CHECK ((derivative_hash ~ '^sha256-[0-9a-f]{64}$'::text)),
    CONSTRAINT model_revisions_derivative_mime_check CHECK ((derivative_mime = 'model/gltf-binary'::text)),
    CONSTRAINT model_revisions_recipe_id_check CHECK ((((char_length(recipe_id) >= 1) AND (char_length(recipe_id) <= 128)) AND (recipe_id = btrim(recipe_id)))),
    CONSTRAINT model_revisions_recipe_version_check CHECK ((recipe_version > 0)),
    CONSTRAINT model_revisions_report_digest_check CHECK ((report_digest ~ '^sha256-[0-9a-f]{64}$'::text)),
    CONSTRAINT model_revisions_source_bytes_check CHECK (((source_bytes >= 1) AND (source_bytes <= 52428800))),
    CONSTRAINT model_revisions_source_file_count_check CHECK ((source_file_count > 0)),
    CONSTRAINT model_revisions_source_keys_array CHECK (((source_keys IS NULL) OR (jsonb_typeof(source_keys) = 'array'::text))),
    CONSTRAINT model_revisions_source_manifest_hash_check CHECK ((source_manifest_hash ~ '^sha256-[0-9a-f]{64}$'::text))
);


--
-- Name: project_deletions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE project_deletions (
    project_id text NOT NULL,
    owner_id text NOT NULL,
    namespace text NOT NULL,
    saved_base_token text NOT NULL,
    status text NOT NULL,
    key_inventory jsonb DEFAULT '[]'::jsonb NOT NULL,
    sweep_dependent boolean DEFAULT false NOT NULL,
    fenced_at timestamp with time zone NOT NULL,
    handler_timeout_ms integer NOT NULL,
    lease_deadline_ms integer NOT NULL,
    renewal_interval_ms integer NOT NULL,
    abort_margin_ms integer NOT NULL,
    cleanup_bound_ms integer NOT NULL,
    first_empty_at timestamp with time zone,
    last_attempt_at timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT project_deletions_abort_margin_ms_check CHECK ((abort_margin_ms > 0)),
    CONSTRAINT project_deletions_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT project_deletions_check CHECK (((lease_deadline_ms > 0) AND (lease_deadline_ms < handler_timeout_ms))),
    CONSTRAINT project_deletions_check1 CHECK ((cleanup_bound_ms >= ((handler_timeout_ms + renewal_interval_ms) + abort_margin_ms))),
    CONSTRAINT project_deletions_check2 CHECK ((((status = 'pending'::text) AND (completed_at IS NULL)) OR ((status = 'complete'::text) AND (completed_at IS NOT NULL)))),
    CONSTRAINT project_deletions_handler_timeout_ms_check CHECK ((handler_timeout_ms > 0)),
    CONSTRAINT project_deletions_key_inventory_check CHECK ((jsonb_typeof(key_inventory) = 'array'::text)),
    CONSTRAINT project_deletions_namespace_check CHECK ((namespace ~ '^[a-z0-9][a-z0-9-]{0,31}$'::text)),
    CONSTRAINT project_deletions_renewal_interval_ms_check CHECK ((renewal_interval_ms > 0)),
    CONSTRAINT project_deletions_saved_base_token_check CHECK ((saved_base_token ~ '^saved-base:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text)),
    CONSTRAINT project_deletions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'complete'::text])))
);


--
-- Name: project_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE project_versions (
    id bigint NOT NULL,
    project_id text NOT NULL,
    version integer NOT NULL,
    document jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source_format text NOT NULL,
    CONSTRAINT project_versions_document_check CHECK ((jsonb_typeof(document) = 'object'::text)),
    CONSTRAINT project_versions_source_format_fence CHECK ((source_format = 'unit-envelope-v1'::text)),
    CONSTRAINT project_versions_unit_envelope_document CHECK (((jsonb_typeof(document) = 'object'::text) AND (document ? 'formatVersion'::text) AND (jsonb_typeof((document -> 'formatVersion'::text)) = 'number'::text) AND ((document ->> 'formatVersion'::text) = '1'::text) AND (document ? 'id'::text) AND (jsonb_typeof((document -> 'id'::text)) = 'string'::text) AND (document ? 'name'::text) AND (jsonb_typeof((document -> 'name'::text)) = 'string'::text) AND (document ? 'acceptedRevision'::text) AND (jsonb_typeof((document -> 'acceptedRevision'::text)) = 'object'::text) AND (document ? 'dependencyLock'::text) AND (jsonb_typeof((document -> 'dependencyLock'::text)) = 'object'::text) AND (document ? 'units'::text) AND (jsonb_typeof((document -> 'units'::text)) = 'object'::text) AND ((document -> 'units'::text) ? 'layout'::text) AND (jsonb_typeof(((document -> 'units'::text) -> 'layout'::text)) = 'object'::text) AND ((document -> 'units'::text) ? 'scene'::text) AND (jsonb_typeof(((document -> 'units'::text) -> 'scene'::text)) = 'object'::text) AND ((document -> 'units'::text) ? 'camera'::text) AND (jsonb_typeof(((document -> 'units'::text) -> 'camera'::text)) = 'object'::text) AND ((document -> 'units'::text) ? 'experience'::text) AND (jsonb_typeof(((document -> 'units'::text) -> 'experience'::text)) = 'object'::text) AND ((document -> 'units'::text) ? 'resources'::text) AND (jsonb_typeof(((document -> 'units'::text) -> 'resources'::text)) = 'object'::text))),
    CONSTRAINT project_versions_version_check CHECK ((version > 0))
);


--
-- Name: project_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE project_versions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME project_versions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: project_write_leases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE project_write_leases (
    id uuid NOT NULL,
    project_id text NOT NULL,
    owner_id text NOT NULL,
    started_at timestamp with time zone NOT NULL,
    heartbeat_at timestamp with time zone NOT NULL,
    deadline_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    released_at timestamp with time zone,
    CONSTRAINT project_write_leases_check CHECK ((deadline_at > started_at)),
    CONSTRAINT project_write_leases_check1 CHECK ((heartbeat_at >= started_at))
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE projects (
    id text NOT NULL,
    owner_id text NOT NULL,
    name text NOT NULL,
    latest_version integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    saved_base_token text DEFAULT ('saved-base:'::text || (gen_random_uuid())::text) NOT NULL,
    saved_revision jsonb,
    saved_source_content_id text,
    saved_full_source_hash text,
    CONSTRAINT projects_latest_version_check CHECK ((latest_version >= 0)),
    CONSTRAINT projects_saved_base_token_format CHECK ((saved_base_token ~ '^saved-base:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text))
);


--
-- Name: publications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE publications (
    project_id text NOT NULL,
    public_id uuid NOT NULL,
    active_version integer,
    revision integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT publications_active_version_check CHECK (((active_version IS NULL) OR (active_version > 0))),
    CONSTRAINT publications_revision_check CHECK ((revision >= 0))
);


--
-- Name: releases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE releases (
    project_id text NOT NULL,
    version integer NOT NULL,
    manifest jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT releases_manifest_check CHECK ((jsonb_typeof(manifest) = 'object'::text)),
    CONSTRAINT releases_version_check CHECK ((version > 0))
);


--
-- Name: save_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE save_receipts (
    project_id text NOT NULL,
    operation_id text NOT NULL,
    precondition_kind text NOT NULL,
    precondition_token text,
    accepted_revision jsonb NOT NULL,
    source_content_id text NOT NULL,
    full_source_hash text NOT NULL,
    version integer NOT NULL,
    saved_base_token text NOT NULL,
    saved_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT save_receipts_check CHECK ((((precondition_kind = 'create-only'::text) AND (precondition_token IS NULL)) OR ((precondition_kind = 'expected-saved-base'::text) AND (precondition_token IS NOT NULL)))),
    CONSTRAINT save_receipts_precondition_kind_check CHECK ((precondition_kind = ANY (ARRAY['create-only'::text, 'expected-saved-base'::text]))),
    CONSTRAINT save_receipts_version_check CHECK ((version > 0))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE users (
    id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assets assets_object_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY assets
    ADD CONSTRAINT assets_object_key_key UNIQUE (object_key);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: auth_attempts auth_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY auth_attempts
    ADD CONSTRAINT auth_attempts_pkey PRIMARY KEY (key);


--
-- Name: form_library_items form_library_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY form_library_items
    ADD CONSTRAINT form_library_items_pkey PRIMARY KEY (id);


--
-- Name: image_repair_attempts image_repair_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY image_repair_attempts
    ADD CONSTRAINT image_repair_attempts_pkey PRIMARY KEY (id);


--
-- Name: image_repair_attempts image_repair_attempts_staging_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY image_repair_attempts
    ADD CONSTRAINT image_repair_attempts_staging_key_key UNIQUE (staging_key);


--
-- Name: library_receipts library_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY library_receipts
    ADD CONSTRAINT library_receipts_pkey PRIMARY KEY (owner_id, operation_kind, operation_id);


--
-- Name: library_staging library_staging_object_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY library_staging
    ADD CONSTRAINT library_staging_object_key_key UNIQUE (object_key);


--
-- Name: library_staging library_staging_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY library_staging
    ADD CONSTRAINT library_staging_pkey PRIMARY KEY (id);


--
-- Name: local_credentials local_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY local_credentials
    ADD CONSTRAINT local_credentials_pkey PRIMARY KEY (user_id);


--
-- Name: local_credentials local_credentials_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY local_credentials
    ADD CONSTRAINT local_credentials_username_key UNIQUE (username);


--
-- Name: material_library_images material_library_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY material_library_images
    ADD CONSTRAINT material_library_images_pkey PRIMARY KEY (item_id, hash);


--
-- Name: model_import_files model_import_files_object_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY model_import_files
    ADD CONSTRAINT model_import_files_object_key_key UNIQUE (object_key);


--
-- Name: model_import_files model_import_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY model_import_files
    ADD CONSTRAINT model_import_files_pkey PRIMARY KEY (import_id, file_id);


--
-- Name: model_imports model_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY model_imports
    ADD CONSTRAINT model_imports_pkey PRIMARY KEY (id);


--
-- Name: model_revisions model_revisions_derivative_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY model_revisions
    ADD CONSTRAINT model_revisions_derivative_key_key UNIQUE (derivative_key);


--
-- Name: model_revisions model_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY model_revisions
    ADD CONSTRAINT model_revisions_pkey PRIMARY KEY (id);


--
-- Name: model_revisions model_revisions_project_id_content_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY model_revisions
    ADD CONSTRAINT model_revisions_project_id_content_hash_key UNIQUE (project_id, content_hash);


--
-- Name: project_deletions project_deletions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY project_deletions
    ADD CONSTRAINT project_deletions_pkey PRIMARY KEY (project_id);


--
-- Name: project_versions project_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY project_versions
    ADD CONSTRAINT project_versions_pkey PRIMARY KEY (id);


--
-- Name: project_versions project_versions_project_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY project_versions
    ADD CONSTRAINT project_versions_project_id_version_key UNIQUE (project_id, version);


--
-- Name: project_write_leases project_write_leases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY project_write_leases
    ADD CONSTRAINT project_write_leases_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: publications publications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY publications
    ADD CONSTRAINT publications_pkey PRIMARY KEY (project_id);


--
-- Name: publications publications_public_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY publications
    ADD CONSTRAINT publications_public_id_key UNIQUE (public_id);


--
-- Name: releases releases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY releases
    ADD CONSTRAINT releases_pkey PRIMARY KEY (project_id, version);


--
-- Name: save_receipts save_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY save_receipts
    ADD CONSTRAINT save_receipts_pkey PRIMARY KEY (project_id, operation_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: assets_project_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_project_created_at_idx ON assets USING btree (project_id, created_at DESC, id);


--
-- Name: auth_attempts_window_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_attempts_window_idx ON auth_attempts USING btree (window_start);


--
-- Name: form_library_items_owner_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX form_library_items_owner_created_idx ON form_library_items USING btree (owner_id, created_at DESC, id);


--
-- Name: form_library_items_thumbnail_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX form_library_items_thumbnail_key_idx ON form_library_items USING btree (thumbnail_key) WHERE (thumbnail_key IS NOT NULL);


--
-- Name: image_repair_attempts_project_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX image_repair_attempts_project_expiry_idx ON image_repair_attempts USING btree (project_id, owner_id, expires_at);


--
-- Name: library_staging_owner_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX library_staging_owner_expiry_idx ON library_staging USING btree (owner_id, expires_at);


--
-- Name: material_library_images_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX material_library_images_item_idx ON material_library_images USING btree (item_id, hash);


--
-- Name: material_library_images_object_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX material_library_images_object_key_idx ON material_library_images USING btree (object_key) WHERE (object_key IS NOT NULL);


--
-- Name: model_import_files_declared_path_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX model_import_files_declared_path_idx ON model_import_files USING btree (import_id, path);


--
-- Name: model_imports_project_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_imports_project_state_idx ON model_imports USING btree (project_id, state, expires_at);


--
-- Name: model_revisions_project_derivative_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_revisions_project_derivative_idx ON model_revisions USING btree (project_id, derivative_hash);


--
-- Name: project_deletions_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_deletions_pending_idx ON project_deletions USING btree (fenced_at, project_id) WHERE (status = 'pending'::text);


--
-- Name: project_write_leases_live_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_write_leases_live_idx ON project_write_leases USING btree (project_id, deadline_at) WHERE (released_at IS NULL);


--
-- Name: projects_owner_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX projects_owner_updated_at_idx ON projects USING btree (owner_id, updated_at DESC);


--
-- Name: assets assets_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY assets
    ADD CONSTRAINT assets_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id);


--
-- Name: form_library_items form_library_items_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY form_library_items
    ADD CONSTRAINT form_library_items_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;


--
-- Name: image_repair_attempts image_repair_attempts_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY image_repair_attempts
    ADD CONSTRAINT image_repair_attempts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;


--
-- Name: image_repair_attempts image_repair_attempts_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY image_repair_attempts
    ADD CONSTRAINT image_repair_attempts_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;


--
-- Name: library_receipts library_receipts_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY library_receipts
    ADD CONSTRAINT library_receipts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;


--
-- Name: library_staging library_staging_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY library_staging
    ADD CONSTRAINT library_staging_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;


--
-- Name: local_credentials local_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY local_credentials
    ADD CONSTRAINT local_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);


--
-- Name: material_library_images material_library_images_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY material_library_images
    ADD CONSTRAINT material_library_images_item_id_fkey FOREIGN KEY (item_id) REFERENCES form_library_items(id) ON DELETE CASCADE;


--
-- Name: model_import_files model_import_files_import_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY model_import_files
    ADD CONSTRAINT model_import_files_import_id_fkey FOREIGN KEY (import_id) REFERENCES model_imports(id) ON DELETE CASCADE;


--
-- Name: model_imports model_imports_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY model_imports
    ADD CONSTRAINT model_imports_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;


--
-- Name: model_imports model_imports_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY model_imports
    ADD CONSTRAINT model_imports_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;


--
-- Name: model_revisions model_revisions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY model_revisions
    ADD CONSTRAINT model_revisions_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;


--
-- Name: project_versions project_versions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY project_versions
    ADD CONSTRAINT project_versions_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id);


--
-- Name: projects projects_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY projects
    ADD CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id);


--
-- Name: publications publications_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY publications
    ADD CONSTRAINT publications_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id);


--
-- Name: releases releases_project_id_version_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY releases
    ADD CONSTRAINT releases_project_id_version_fkey FOREIGN KEY (project_id, version) REFERENCES project_versions(project_id, version);


--
-- Name: save_receipts save_receipts_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY save_receipts
    ADD CONSTRAINT save_receipts_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


