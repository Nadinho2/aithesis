-- ═══════════════════════════════════════════════
-- FIX: user_id columns uuid → text (Clerk IDs)
-- ═══════════════════════════════════════════════
-- Run this ENTIRE block in Supabase SQL Editor
-- ═══════════════════════════════════════════════

-- 1) Check current types (before)
SELECT 'BEFORE' AS step, table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND column_name IN ('id','user_id')
ORDER BY table_name, column_name;

-- 2) Drop triggers & functions referencing auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_role ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_new_user_role();
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 3) Drop ALL FK constraints referencing auth.users
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN (
    SELECT con.conname, con.conrelid::regclass AS tbl
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE con.confrelid = 'auth.users'::regclass
      AND con.contype = 'f'
      AND rel.relnamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
  END LOOP;
END $$;

-- 4) Drop primary key constraints on profiles BEFORE changing type
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey;

-- 5) Change columns uuid → text
ALTER TABLE public.profiles           ALTER COLUMN id        TYPE text;
ALTER TABLE public.topic_generations  ALTER COLUMN user_id   TYPE text;
ALTER TABLE public.topics             ALTER COLUMN user_id   TYPE text;
ALTER TABLE public.proposals          ALTER COLUMN user_id   TYPE text;
ALTER TABLE public.theses             ALTER COLUMN user_id   TYPE text;
ALTER TABLE public.user_roles         ALTER COLUMN user_id   TYPE text;

-- 6) Re-add primary key on profiles
ALTER TABLE public.profiles ADD PRIMARY KEY (id);

-- 7) Recreate has_role with text param
CREATE OR REPLACE FUNCTION public.has_role(_user_id text, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- 8) Verify (after)
SELECT 'AFTER' AS step, table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND column_name IN ('id','user_id')
ORDER BY table_name, column_name;
