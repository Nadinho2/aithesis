-- Migrate all user_id columns from uuid (Supabase Auth) to text (Clerk IDs)
-- Clerk IDs look like: user_3F4f60dx0aiTfrAUkBIL9EvQSeJ

-- 1. Drop triggers that reference auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_role ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_new_user_role();

-- 2. Drop the has_role function (uses uuid param)
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 3. Drop foreign key constraints referencing auth.users(id)
ALTER TABLE public.profiles      DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.topic_generations DROP CONSTRAINT IF EXISTS topic_generations_user_id_fkey;
ALTER TABLE public.topics        DROP CONSTRAINT IF EXISTS topics_user_id_fkey;
ALTER TABLE public.proposals     DROP CONSTRAINT IF EXISTS proposals_user_id_fkey;
ALTER TABLE public.theses        DROP CONSTRAINT IF EXISTS theses_user_id_fkey;
ALTER TABLE public.user_roles    DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- 4. Change columns from uuid to text
ALTER TABLE public.profiles      ALTER COLUMN id TYPE text;
ALTER TABLE public.topic_generations ALTER COLUMN user_id TYPE text;
ALTER TABLE public.topics        ALTER COLUMN user_id TYPE text;
ALTER TABLE public.proposals     ALTER COLUMN user_id TYPE text;
ALTER TABLE public.theses        ALTER COLUMN user_id TYPE text;
ALTER TABLE public.user_roles    ALTER COLUMN user_id TYPE text;

-- 5. Recreate primary key for profiles (was id uuid primary key, now text)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey;
ALTER TABLE public.profiles ADD PRIMARY KEY (id);

-- 6. Recreate has_role with text param
CREATE OR REPLACE FUNCTION public.has_role(_user_id text, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Note: RLS policies using auth.uid() still reference Supabase Auth.
-- Since server functions use the service_role key (bypassing RLS),
-- this is fine. Client-side RLS will not work with Clerk IDs,
-- but the app doesn't rely on client-side queries directly.
