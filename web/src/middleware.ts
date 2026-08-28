import { NextResponse, type NextRequest } from "next/server";

/**
 * The back-office answers only on its own subdomain.
 *
 * One project serves the farmer app, the partner portal and the console; sessions are already
 * isolated by origin (localStorage is per-origin) and authorization is entirely server-side. This
 * adds the last piece: `/console/**` simply does not exist anywhere but `admin.<domain>`, so the
 * back-office is not even discoverable from the app or the portal.
 *
 * In development every host is allowed, otherwise `localhost:3000/console` would be unreachable.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const isAdminHost = host.startsWith("admin.") || host.startsWith("localhost");
  if (!isAdminHost) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/console/:path*"],
};
