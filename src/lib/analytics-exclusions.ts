// User IDs whose activity must be excluded from analytics/traffic metrics
// to avoid skewing numbers (admins and the official WaveChat account).
export const EXCLUDED_ANALYTICS_USER_IDS: readonly string[] = [
  "fb26450c-1a1c-43cb-b18e-ca098d151e00", // superadmin (Vitor)
  "cf87cfb4-07ca-4799-813e-d9444f574818", // official WaveChat account
];

// PostgREST list literal, e.g. (uuid1,uuid2) — for use with .not('user_id','in', ...)
export const EXCLUDED_ANALYTICS_USER_IDS_PG = `(${EXCLUDED_ANALYTICS_USER_IDS.join(",")})`;

export function isExcludedAnalyticsUser(userId: string | null | undefined): boolean {
  return !!userId && EXCLUDED_ANALYTICS_USER_IDS.includes(userId);
}
