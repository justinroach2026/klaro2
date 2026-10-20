-- Read-only: emits the DDL for the public schema (plus the auth trigger and storage setup) as text.
-- search_path = pg_catalog makes every pg_get_* function print fully qualified names.
SET search_path = pg_catalog;

WITH
tbl AS (
    SELECT c.oid, c.relname, format('%I.%I', n.nspname, c.relname) AS qname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
),
seq AS (
    SELECT c.oid, c.relname, format('public.%I', c.relname) AS qname, s.*
    FROM pg_class c JOIN pg_sequence s ON s.seqrelid = c.oid
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'S'
),
fn AS (
    SELECT p.oid, p.proname, p.oid::regprocedure::text AS sig, p.proacl, l.lanname
    FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
),
api_roles(r) AS (VALUES ('anon'), ('authenticated'), ('service_role')),
parts(sec, ord, line) AS (
    -- 00 extensions
    SELECT 0, '0', 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;'
    UNION ALL SELECT 0, '1', 'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;'

    -- 10 sequences
    UNION ALL
    SELECT 10, relname, format('CREATE SEQUENCE %s AS %s INCREMENT BY %s MINVALUE %s MAXVALUE %s START WITH %s CACHE %s%s;',
        qname, format_type(seqtypid, NULL), seqincrement, seqmin, seqmax, seqstart, seqcache, CASE WHEN seqcycle THEN ' CYCLE' ELSE '' END)
    FROM seq

    -- 20 tables (columns, defaults, NOT NULL)
    UNION ALL
    SELECT 20, t.relname, format(E'CREATE TABLE %s (\n%s\n);', t.qname, (
        SELECT string_agg(format('    %I %s%s%s', a.attname, format_type(a.atttypid, a.atttypmod),
                   CASE WHEN d.adbin IS NOT NULL THEN ' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid) ELSE '' END,
                   CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END), E',\n' ORDER BY a.attnum)
        FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped))
    FROM tbl t

    -- 25 sequence ownership
    UNION ALL
    SELECT 25, s.relname, format('ALTER SEQUENCE %s OWNED BY %s.%I;', s.qname, format('public.%I', tc.relname), a.attname)
    FROM seq s JOIN pg_depend dep ON dep.objid = s.oid AND dep.deptype = 'a' AND dep.classid = 'pg_class'::regclass
    JOIN pg_class tc ON tc.oid = dep.refobjid JOIN pg_attribute a ON a.attrelid = tc.oid AND a.attnum = dep.refobjsubid

    -- 30 PK / UNIQUE / CHECK, 31 foreign keys (after every table exists)
    UNION ALL
    SELECT CASE WHEN con.contype = 'f' THEN 31 ELSE 30 END, t.relname || '.' || con.contype::text || '.' || con.conname,
        format('ALTER TABLE %s ADD CONSTRAINT %I %s;', t.qname, con.conname, pg_get_constraintdef(con.oid))
    FROM pg_constraint con JOIN tbl t ON t.oid = con.conrelid
    WHERE con.contype IN ('p', 'u', 'c', 'f')

    -- 35 other indexes
    UNION ALL
    SELECT 35, ic.relname, pg_get_indexdef(i.indexrelid) || ';'
    FROM pg_index i JOIN tbl t ON t.oid = i.indrelid JOIN pg_class ic ON ic.oid = i.indexrelid
    WHERE NOT EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conindid = i.indexrelid)

    -- 40 comments
    UNION ALL
    SELECT 40, t.relname || '.' || coalesce(a.attname, ''),
        CASE WHEN d.objsubid = 0 THEN format('COMMENT ON TABLE %s IS %L;', t.qname, d.description)
             ELSE format('COMMENT ON COLUMN %s.%I IS %L;', t.qname, a.attname, d.description) END
    FROM pg_description d JOIN tbl t ON t.oid = d.objoid AND d.classoid = 'pg_class'::regclass
    LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.objsubid

    -- 50 functions (after tables: SQL-language bodies are validated against them)
    UNION ALL
    SELECT 50, CASE WHEN f.lanname = 'sql' THEN '0' ELSE '1' END || f.sig, pg_get_functiondef(f.oid) || ';'
    FROM fn f

    -- 55 function privileges (Supabase grants EXECUTE to the API roles by default; restate exactly)
    UNION ALL
    SELECT 55, f.sig || '.0', format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role;', f.sig)
    FROM fn f WHERE f.proacl IS NOT NULL
    UNION ALL
    SELECT 55, f.sig || '.1.' || coalesce(r.rolname, 'PUBLIC'),
        format('GRANT EXECUTE ON FUNCTION %s TO %s;', f.sig, coalesce(quote_ident(r.rolname), 'PUBLIC'))
    FROM fn f CROSS JOIN LATERAL aclexplode(f.proacl) x LEFT JOIN pg_roles r ON r.oid = x.grantee
    WHERE f.proacl IS NOT NULL AND x.privilege_type = 'EXECUTE' AND coalesce(r.rolname, 'PUBLIC') <> 'postgres'

    -- 60 row level security
    UNION ALL
    SELECT 60, c.relname, format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', format('public.%I', c.relname))
    FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND c.relrowsecurity

    -- 65 policies on public tables and storage.objects
    UNION ALL
    SELECT 65, p.schemaname || '.' || p.tablename || '.' || p.policyname,
        CASE WHEN p.schemaname = 'storage' THEN format('DROP POLICY IF EXISTS %I ON %I.%I;', p.policyname, p.schemaname, p.tablename) || E'\n' ELSE '' END
        || format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
            p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd,
            (SELECT string_agg(CASE WHEN x = 'public' THEN 'public' ELSE quote_ident(x) END, ', ') FROM unnest(p.roles) x),
            CASE WHEN p.qual IS NOT NULL THEN E'\n    USING (' || p.qual || ')' ELSE '' END,
            CASE WHEN p.with_check IS NOT NULL THEN E'\n    WITH CHECK (' || p.with_check || ')' ELSE '' END)
    FROM pg_policies p
    WHERE p.schemaname = 'public'
       OR (p.schemaname = 'storage' AND p.tablename = 'objects'
           AND p.policyname IN (SELECT policyname FROM pg_policies WHERE schemaname = 'storage'))

    -- 70 triggers (public tables + the signup trigger on auth.users)
    UNION ALL
    SELECT 70, tg.tgrelid::regclass::text || '.' || tg.tgname,
        CASE WHEN c.relnamespace <> 'public'::regnamespace
             THEN format('DROP TRIGGER IF EXISTS %I ON %s;', tg.tgname, tg.tgrelid::regclass) || E'\n' ELSE '' END
        || pg_get_triggerdef(tg.oid) || ';'
    FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_proc p ON p.oid = tg.tgfoid
    WHERE NOT tg.tgisinternal
      AND (c.relnamespace = 'public'::regnamespace OR p.pronamespace = 'public'::regnamespace)

    -- 80 table + sequence privileges, restated exactly (table level, then column level)
    UNION ALL
    SELECT 80, c.relname || '.0', format('REVOKE ALL ON %s %s FROM anon, authenticated, service_role;',
        CASE c.relkind WHEN 'S' THEN 'SEQUENCE' ELSE 'TABLE' END, format('public.%I', c.relname))
    FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'S')
    UNION ALL
    SELECT 80, c.relname || '.1.' || r.rolname || g.is_grantable::text,
        format('GRANT %s ON %s %s TO %I%s;', string_agg(g.privilege_type, ', ' ORDER BY g.privilege_type),
            CASE c.relkind WHEN 'S' THEN 'SEQUENCE' ELSE 'TABLE' END, format('public.%I', c.relname), r.rolname,
            CASE WHEN g.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
    FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) g JOIN pg_roles r ON r.oid = g.grantee
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'S') AND r.rolname IN (SELECT r FROM api_roles)
    GROUP BY c.relname, c.relkind, r.rolname, g.is_grantable
    UNION ALL
    SELECT 80, c.relname || '.2.' || r.rolname || g.privilege_type,
        format('GRANT %s (%s) ON TABLE %s TO %I;', g.privilege_type, string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum),
            format('public.%I', c.relname), r.rolname)
    FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
    CROSS JOIN LATERAL aclexplode(a.attacl) g JOIN pg_roles r ON r.oid = g.grantee
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND r.rolname IN (SELECT r FROM api_roles)
    GROUP BY c.relname, r.rolname, g.privilege_type

    -- 90 storage buckets
    UNION ALL
    SELECT 90, b.id, format('INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES (%L, %L, %s, %s, %s) ON CONFLICT (id) DO NOTHING;',
        b.id, b.name, CASE WHEN b.public THEN 'true' ELSE 'false' END, coalesce(b.file_size_limit::text, 'NULL'),
        CASE WHEN b.allowed_mime_types IS NULL THEN 'NULL' ELSE quote_literal(b.allowed_mime_types::text) || '::text[]' END)
    FROM storage.buckets b
)
SELECT sec, ord, line FROM parts ORDER BY sec, ord;
