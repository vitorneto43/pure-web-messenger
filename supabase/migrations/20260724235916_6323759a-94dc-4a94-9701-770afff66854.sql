
-- Reprice plans: single flat fee, member cap is the only real quota
UPDATE public.ecosystem_plan_limits SET
  member_limit = 100,
  posts_per_month = 1000000000,
  videos_per_month = 1000000000,
  lives_per_month = 1000000000,
  price_brl_month = 0,
  display_name = 'Free',
  custom_branding = false,
  advanced_metrics = false,
  custom_subdomain = false,
  priority_support = false
WHERE tier = 'free';

UPDATE public.ecosystem_plan_limits SET
  member_limit = 500,
  posts_per_month = 1000000000,
  videos_per_month = 1000000000,
  lives_per_month = 1000000000,
  price_brl_month = 60,
  display_name = 'Pro',
  custom_branding = true,
  advanced_metrics = true,
  custom_subdomain = false,
  priority_support = false
WHERE tier = 'pro';

UPDATE public.ecosystem_plan_limits SET
  member_limit = 1000,
  posts_per_month = 1000000000,
  videos_per_month = 1000000000,
  lives_per_month = 1000000000,
  price_brl_month = 100,
  display_name = 'Business',
  custom_branding = true,
  advanced_metrics = true,
  custom_subdomain = true,
  priority_support = true
WHERE tier = 'business';

UPDATE public.ecosystem_plan_limits SET
  member_limit = 1000000000,
  posts_per_month = 1000000000,
  videos_per_month = 1000000000,
  lives_per_month = 1000000000,
  price_brl_month = 250,
  display_name = 'Enterprise',
  custom_branding = true,
  advanced_metrics = true,
  custom_subdomain = true,
  priority_support = true
WHERE tier = 'enterprise';

-- Remove per-content monthly quota enforcement — plan is all-inclusive; only member cap matters.
CREATE OR REPLACE FUNCTION public.enforce_ecosystem_content_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;
