
CREATE OR REPLACE FUNCTION public.admin_dump_schema()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  out_sql text := '';
  r record;
  c record;
  col_sql text;
  enum_vals text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  out_sql := '-- FinTask schema dump' || E'\n' ||
             '-- Generated: ' || now()::text || E'\n\n' ||
             'BEGIN;' || E'\n\n';

  -- Enums in public
  FOR r IN
    SELECT t.typname,
           string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) AS labels
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname
  LOOP
    out_sql := out_sql || 'DO $do$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = ' ||
               quote_literal(r.typname) || ') THEN CREATE TYPE public.' || quote_ident(r.typname) ||
               ' AS ENUM (' || r.labels || '); END IF; END $do$;' || E'\n';
  END LOOP;
  out_sql := out_sql || E'\n';

  -- Tables
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  LOOP
    out_sql := out_sql || '-- Table: ' || r.tablename || E'\n';
    out_sql := out_sql || 'CREATE TABLE IF NOT EXISTS public.' || quote_ident(r.tablename) || ' (' || E'\n';
    col_sql := '';
    FOR c IN
      SELECT column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=r.tablename
      ORDER BY ordinal_position
    LOOP
      col_sql := col_sql || '  ' || quote_ident(c.column_name) || ' ' ||
        CASE
          WHEN c.data_type = 'USER-DEFINED' THEN 'public.' || quote_ident(c.udt_name)
          WHEN c.data_type = 'ARRAY' THEN
            CASE WHEN c.udt_name LIKE '\_%' ESCAPE '\' THEN substring(c.udt_name from 2) || '[]' ELSE c.udt_name END
          WHEN c.data_type = 'character varying' AND c.character_maximum_length IS NOT NULL
            THEN 'varchar(' || c.character_maximum_length || ')'
          ELSE c.data_type
        END ||
        CASE WHEN c.column_default IS NOT NULL THEN ' DEFAULT ' || c.column_default ELSE '' END ||
        CASE WHEN c.is_nullable='NO' THEN ' NOT NULL' ELSE '' END ||
        ',' || E'\n';
    END LOOP;
    -- primary key
    FOR c IN
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = ('public.' || quote_ident(r.tablename))::regclass
        AND contype IN ('p','u','c')
    LOOP
      col_sql := col_sql || '  CONSTRAINT ' || quote_ident(c.conname) || ' ' || c.def || ',' || E'\n';
    END LOOP;
    -- strip trailing comma
    col_sql := regexp_replace(col_sql, ',\s*$', E'\n');
    out_sql := out_sql || col_sql || ');' || E'\n';

    -- Grants (sensible default)
    out_sql := out_sql || 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.' || quote_ident(r.tablename) || ' TO authenticated;' || E'\n';
    out_sql := out_sql || 'GRANT ALL ON public.' || quote_ident(r.tablename) || ' TO service_role;' || E'\n';
    out_sql := out_sql || 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;' || E'\n';

    -- Policies
    FOR c IN
      SELECT policyname, cmd, permissive, roles, qual, with_check
      FROM pg_policies WHERE schemaname='public' AND tablename=r.tablename
    LOOP
      out_sql := out_sql || 'CREATE POLICY ' || quote_ident(c.policyname) ||
        ' ON public.' || quote_ident(r.tablename) ||
        ' AS ' || c.permissive ||
        ' FOR ' || c.cmd ||
        ' TO ' || array_to_string(c.roles, ', ') ||
        CASE WHEN c.qual IS NOT NULL THEN ' USING (' || c.qual || ')' ELSE '' END ||
        CASE WHEN c.with_check IS NOT NULL THEN ' WITH CHECK (' || c.with_check || ')' ELSE '' END ||
        ';' || E'\n';
    END LOOP;
    out_sql := out_sql || E'\n';
  END LOOP;

  -- Functions
  out_sql := out_sql || '-- Functions' || E'\n';
  FOR r IN
    SELECT p.proname, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public'
  LOOP
    out_sql := out_sql || r.def || ';' || E'\n\n';
  END LOOP;

  out_sql := out_sql || 'COMMIT;' || E'\n';
  RETURN out_sql;
END; $$;
