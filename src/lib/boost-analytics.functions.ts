import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ boostId: z.string().uuid() });

export const getBoostReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof schema>) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { data: report, error } = await supabase.rpc("get_boost_report", {
      _boost_id: data.boostId,
    });
    if (error) throw new Error(error.message);
    return report as any;
  });

export const getPostBoostReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof schema>) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { data: report, error } = await supabase.rpc("get_post_boost_report", {
      _boost_id: data.boostId,
    });
    if (error) throw new Error(error.message);
    return report as any;
  });

const adminSchema = z.object({ days: z.number().int().min(1).max(365).default(30) });

export const getAdminBoostStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof adminSchema>) => adminSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { data: stats, error } = await supabase.rpc("admin_boost_overview", {
      _days: data.days,
    });
    if (error) throw new Error(error.message);
    return stats as any;
  });

const clickSchema = z.object({ statusId: z.string().uuid() });

export const trackBoostClick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof clickSchema>) => clickSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { data: r, error } = await supabase.rpc("register_boost_click", {
      _status_id: data.statusId,
    });
    if (error) return { ok: false };
    return r as any;
  });
