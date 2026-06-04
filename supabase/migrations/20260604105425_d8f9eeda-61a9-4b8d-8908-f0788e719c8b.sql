
-- 2. Hierarchy helper: returns rank where higher = more privileged
CREATE OR REPLACE FUNCTION public.role_rank(_role public.app_role)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'superadmin' THEN 40
    WHEN 'admin'      THEN 30
    WHEN 'moderator'  THEN 20
    WHEN 'user'       THEN 10
    ELSE 0
  END;
$$;

-- 3. Min role check (superadmin satisfies admin, admin satisfies moderator, etc.)
CREATE OR REPLACE FUNCTION public.has_min_role(_user_id uuid, _min public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND public.role_rank(role) >= public.role_rank(_min)
  );
$$;

-- 4. Protected SuperAdmin email helper
CREATE OR REPLACE FUNCTION public.is_protected_superadmin_email(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles_private
    WHERE user_id = _user_id
      AND lower(email) = 'wavechataplicativo@gmail.com'
  );
$$;

-- 5. Seed SuperAdmin (idempotent)
INSERT INTO public.user_roles (user_id, role)
SELECT pp.user_id, 'superadmin'::public.app_role
FROM public.profiles_private pp
WHERE lower(pp.email) = 'wavechataplicativo@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 6. Trigger: prevent removing superadmin role from protected email
CREATE OR REPLACE FUNCTION public.protect_superadmin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'superadmin' AND public.is_protected_superadmin_email(OLD.user_id) THEN
    RAISE EXCEPTION 'Cannot remove SuperAdmin role from protected account';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_superadmin ON public.user_roles;
CREATE TRIGGER trg_protect_superadmin
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_superadmin_role();

-- 7. RLS policies so superadmin can manage roles via API (defense in depth;
--    server functions use service role, but we also enable client visibility)
DROP POLICY IF EXISTS "Superadmin can view all roles" ON public.user_roles;
CREATE POLICY "Superadmin can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::public.app_role));

DROP POLICY IF EXISTS "Superadmin can insert roles" ON public.user_roles;
CREATE POLICY "Superadmin can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'::public.app_role));

DROP POLICY IF EXISTS "Superadmin can delete roles" ON public.user_roles;
CREATE POLICY "Superadmin can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::public.app_role));

-- 8. List admins RPC (callable via admin server fn with service role)
CREATE OR REPLACE FUNCTION public.admin_list_admins()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _out jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY rank DESC, created_at ASC), '[]'::jsonb)
  INTO _out FROM (
    SELECT
      ur.user_id,
      ur.role::text AS role,
      public.role_rank(ur.role) AS rank,
      ur.created_at,
      p.username,
      p.display_name,
      p.avatar_url,
      pp.email,
      public.is_protected_superadmin_email(ur.user_id) AS protected
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON p.id = ur.user_id
    LEFT JOIN public.profiles_private pp ON pp.user_id = ur.user_id
    WHERE ur.role IN ('moderator','admin','superadmin')
  ) t;
  RETURN _out;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_admins() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO service_role;
REVOKE EXECUTE ON FUNCTION public.role_rank(public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_min_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_protected_superadmin_email(uuid) FROM PUBLIC, anon;
