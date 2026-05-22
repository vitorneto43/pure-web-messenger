import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    if (!userId) throw new Error("Not authenticated");

    // Best-effort cleanup of user data. auth.users deletion cascades only what
    // FKs declare; we explicitly clear records that reference the user.
    const admin = supabaseAdmin;

    // Remove memberships so conversations don't keep ghost members.
    await admin.from("conversation_members").delete().eq("user_id", userId);
    await admin.from("typing_indicators").delete().eq("user_id", userId);
    await admin.from("push_subscriptions").delete().eq("user_id", userId);
    await admin.from("notifications").delete().eq("user_id", userId);
    await admin.from("status_views").delete().eq("viewer_id", userId);
    await admin.from("statuses").delete().eq("user_id", userId);
    await admin.from("messages").delete().eq("sender_id", userId);
    await admin.from("calls").delete().or(`caller_id.eq.${userId},callee_id.eq.${userId}`);
    await admin.from("profiles").delete().eq("id", userId);

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
