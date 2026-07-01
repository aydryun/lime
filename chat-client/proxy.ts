import { type NextRequest, NextResponse } from "next/server";

// Cookie indicateur, posé côté domaine front au login (voir lib/auth.ts). Le vrai
// JWT vit dans le localStorage et circule via un header Authorization — ce n'est
// PAS un cookie intersite, le middleware s'appuie donc sur cet indicateur lisible.
// Le falsifier ne charge que la coquille de la page ; chaque appel API exige
// toujours un token Bearer valide.
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
