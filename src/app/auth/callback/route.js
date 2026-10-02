import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/auth/return-path";

export async function GET(request) {
  const url = new URL(request.url);
  const next = safeReturnPath(url.searchParams.get("next"));
  const destination = new URL(next, url.origin);
  const code = url.searchParams.get("code");
  if (code && !url.searchParams.has("error")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(destination);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  }
  // Do not expose provider errors or authorization codes to the UI.
  const failure = new URL("/auth/error", url.origin);
  failure.searchParams.set("next", next);
  const response = NextResponse.redirect(failure);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
