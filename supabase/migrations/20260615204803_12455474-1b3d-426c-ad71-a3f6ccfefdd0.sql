ALTER TABLE public.statuses ADD CONSTRAINT statuses_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
NOTIFY pgrst, 'reload schema';