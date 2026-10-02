import { updateSession } from "./lib/supabase/middleware";

export async function proxy(request) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?|ttf)$).*)"],
};
