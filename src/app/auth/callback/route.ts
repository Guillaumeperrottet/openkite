import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback
 * Exchanges the auth code for a session after magic link or OAuth redirect.
 * Supabase sends the user here with ?code=... in the URL.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Sync user to Prisma DB
      try {
        await fetch(`${origin}/api/auth/sync`, {
          method: "POST",
          headers: { cookie: request.headers.get("cookie") ?? "" },
        });
      } catch {
        // Non-blocking
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to home
  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
