import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminToken, passwordMatches } from "@/lib/admin-auth";
import { allow, clientIp, sameOrigin } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return new NextResponse("Forbidden", { status: 403 });
  const to = new URL("/admin", req.url);
  if (!allow(`login:${clientIp(req.headers)}`, 10, 15 * 60_000)) {
    to.searchParams.set("error", "Too many tries. Wait 15 minutes.");
    return NextResponse.redirect(to, 303);
  }
  const pw = String((await req.formData()).get("password") ?? "");
  const token = adminToken();
  if (!token || !passwordMatches(pw)) {
    to.searchParams.set("error", token ? "Wrong password." : "ADMIN_PASSWORD isn't set on the server yet.");
    return NextResponse.redirect(to, 303);
  }
  const res = NextResponse.redirect(to, 303);
  res.cookies.set(ADMIN_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 86400 });
  return res;
}
