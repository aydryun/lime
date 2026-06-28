import { type NextRequest, NextResponse } from "next/server";

// Front-domain flag cookie set at login (see lib/auth.ts). The real JWT lives in
// localStorage and travels as an Authorization header — it is NOT a cross-site
// cookie, so the middleware gates on this readable flag instead. Forging it only
// loads the page shell; every API call still requires a valid Bearer token.
const AUTH_FLAG_COOKIE = "chat_auth";

/**
 * Next.js middleware that gates routes by the auth flag cookie.
 * Redirects unauthenticated requests to /login and authenticated
 * requests away from /login to /chat.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = Boolean(request.cookies.get(AUTH_FLAG_COOKIE)?.value);

  if (pathname.startsWith("/login")) {
    if (hasToken) {
      return NextResponse.redirect(new URL("/chat", request.url));
    }
    return NextResponse.next();
  }

  if (!hasToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
