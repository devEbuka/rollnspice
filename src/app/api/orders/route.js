import { reply } from "@/lib/orders/http";
import { orderSession } from "@/lib/orders/session";
import { validateOrder } from "@/lib/orders/validate";
import { sendOrderConfirmation } from "@/lib/orders/confirmation";
import { validateCheckout } from "@/lib/cart/checkout";

export async function GET(request) {
  try {
    const session = await orderSession(request);
    if (session.response) return session.response;
    const value = new URL(request.url).searchParams.get("page") ?? "1";
    const page = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(page) || page < 1 || page > 10000) {
      return reply({ error: "Page must be an integer between 1 and 10000." }, 400);
    }
    const { data, error } = await session.supabase.from("orders")
      .select("id,status,subtotal,special_instructions,created_at,order_items(id,quantity,unit_price,products(name))")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range((page - 1) * 20, page * 20);
    if (error) return reply({ error: "Order history is temporarily unavailable. Please retry." }, 503);
    const orders = data ?? [];
    return reply({ orders: orders.slice(0, 20), page, hasNext: orders.length > 20 }, 200);
  } catch {
    return reply({ error: "Order history is temporarily unavailable. Please retry." }, 503);
  }
}


export async function POST(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reply({ error: "Request origin is not allowed." }, 403);
  try {
    const session = await orderSession(request);
    if (session.response) return session.response;
    const { supabase, user, bearer } = session;
    let order; let shared;
    try {
      const body = await request.json();
      shared = Object.hasOwn(body ?? {}, "cart_operation_id");
      if (bearer && !shared) return reply({ error: "Mobile checkout requires a saved cart operation ID and revision." }, 400);
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
    const email = shared && data.replayed ? { status: "already_processed" } : await sendOrderConfirmation(supabase, user, placed.id);
    return reply({ order: placed, email, replayed: shared && data.replayed }, 201);
  } catch {
    return reply({ error: "Could not confirm your order. Your cart is saved." }, 503);
  }
}
