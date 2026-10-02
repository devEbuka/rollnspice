import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // Server Components cannot write cookies. The auth task will add
            // a refresh proxy; Route Handlers and Server Actions can write them.
            if (!error.message?.includes("Cookies can only be modified")) {
              throw error;
            }
          }
        },
      },
    },
  );
}

export async function getUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (
    error?.name === "AuthSessionMissingError" ||
    error?.status === 401 ||
    error?.status === 403
  ) {
    return null;
  }
  if (error) throw error;

  return data.user ?? null;
}
