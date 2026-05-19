import { type NextRequest, NextResponse } from "next/server";

const TOKEN_COOKIE = "chat_token";

/**
 * Next.js middleware that gates routes by auth cookie.
 * Redirects unauthenticated requests to /login and authenticated
 * requests away from /login to /chat.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = Boolean(request.cookies.get(TOKEN_COOKIE)?.value);

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
