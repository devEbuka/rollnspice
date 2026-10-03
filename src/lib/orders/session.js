import { createRequestClient } from "@/lib/supabase/request";
import { reply } from "./http";

export async function orderSession(request) {
  try {
    const { supabase, token } = await createRequestClient(request);
    const { data, error } = await supabase.auth.getUser(token);
    if ([400, 401, 403].includes(error?.status) || error?.name === "AuthSessionMissingError" || (!error && !data?.user)) {
      return { response: reply({ error: "Sign in again to access your orders." }, 401) };
    }
    if (error) return { response: reply({ error: "Unable to verify your session. Please retry." }, 503) };
    const account = request.headers.get("x-cart-account");
    if (account !== null && account !== data.user.id) {
      return { response: reply({ error: "Your account changed. Review this account's cart before ordering." }, 409) };
    }
    return { supabase, user: data.user, bearer: token !== undefined };
  } catch (error) {
    return { response: reply({ error: error.status === 401 ? "Sign in again to access your orders." : "Unable to verify your session. Please retry." }, error.status === 401 ? 401 : 503) };
  }
}
