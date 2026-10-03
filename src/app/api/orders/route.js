import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateOrder } from "@/lib/orders/validate";
import { sendOrderConfirmation } from "@/lib/orders/confirmation";
import { validateCheckout } from "@/lib/cart/checkout";

function reply(body, status) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reply({ error: "Request origin is not allowed." }, 403);
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError?.status === 401 || authError?.status === 403 || authError?.name === "AuthSessionMissingError" || (!authError && !auth.user)) {
      return reply({ error: "Sign in again before placing your order." }, 401);
    }
    if (authError) return reply({ error: "Unable to verify your session. Your cart is saved." }, 503);
    const cartAccount = request.headers.get("x-cart-account");
    if (cartAccount && cartAccount !== auth.user.id) return reply({ error: "Your account changed. Review this account's cart before ordering." }, 409);
    let order; let shared;
    try {
      const body = await request.json();
      shared = Object.hasOwn(body ?? {}, "cart_operation_id");
      order = shared ? validateCheckout(body) : validateOrder(body);
    } catch (error) {
      return reply({ error: error instanceof SyntaxError ? "Send a valid JSON order." : error.message }, 400);
    }
    const { data, error } = await supabase.rpc(shared ? "checkout_cart" : "create_order", shared ? order : {
      p_items: order.items,
      p_special_instructions: order.instructions,
    });
    if (error?.message === "CART_CONFLICT") return reply({ error: "Your cart changed. Review the refreshed quantities before placing your order.", conflict: true }, 409);
    if (error?.message === "PRODUCTS_UNAVAILABLE") {
      let missingProductIds = [];
      try { missingProductIds = JSON.parse(error.details); } catch { /* Generic message still preserves the cart. */ }
      return reply({ error: "Some items are no longer on the menu. Remove or replace them before ordering.", missingProductIds }, 409);
    }
    if (error?.code === "22023") return reply({ error: "The order exceeds allowed limits. Check quantities and instructions." }, 400);
    if (error?.message === "AUTH_REQUIRED") return reply({ error: "Sign in again before placing your order." }, 401);
    if (error) return reply({ error: "Could not place your order. Your cart is saved." }, 503);
    const placed = shared ? data.order : data;
    const email = shared && data.replayed ? { status: "already_processed" } : await sendOrderConfirmation(supabase, auth.user, placed.id);
    return reply({ order: placed, email, replayed: shared && data.replayed }, 201);
  } catch {
    return reply({ error: "Could not confirm your order. Your cart is saved." }, 503);
  }
}
