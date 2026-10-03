import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "./server";

export async function createRequestClient(request) {
  const authorization = request.headers.get("authorization");
  if (authorization === null) return { supabase: await createCookieClient(), token: undefined };
  const match = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i.exec(authorization);
  if (!match || match[1].length > 8192) {
    const error = new Error("Invalid authorization header.");
    error.status = 401;
    throw error;
  }
  const token = match[1];
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
  return { supabase, token };
}
