/**
 * Einheitliche Cookie-Optionen für die Supabase-Session. `secure` ist nur in
 * Produktion aktiv (HTTPS); `httpOnly` bleibt aus, weil der Browser-Client die
 * Session lesen können muss.
 */
export const authCookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
