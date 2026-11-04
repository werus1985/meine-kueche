import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";
import { authCookieOptions } from "@/lib/supabase/cookie-options";

type PendingCookie = { name: string; value: string; options: CookieOptions };

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.next({ request });
  }

  // Cookies, die Supabase beim Session-Refresh setzt, erst am Ende auf die
  // tatsächlich zurückgegebene Antwort schreiben.
  const pendingCookies: PendingCookie[] = [];

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        pendingCookies.push(...cookiesToSet);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  function withCookies(response: NextResponse) {
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options);
    }
    return response;
  }

  // Verifizierte Identität an die App weiterreichen. Eingehende Header werden
  // vorher entfernt, damit sie nicht von außen gefälscht werden können.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-mk-user-id");
  requestHeaders.delete("x-mk-user-email");
  if (user) {
    requestHeaders.set("x-mk-user-id", user.id);
    requestHeaders.set("x-mk-user-email", user.email ?? "");
  }

  const { pathname, search } = request.nextUrl;
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isPasswordReset = pathname === "/forgot-password";
  const isPublic =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/invite") ||
    pathname === "/api/health" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/robots.txt";

  if (!user && !isAuthPage && !isPasswordReset && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return withCookies(NextResponse.redirect(url));
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return withCookies(NextResponse.redirect(url));
  }

  return withCookies(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
