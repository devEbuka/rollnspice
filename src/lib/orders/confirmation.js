import "server-only";
import { sendOrderEmail } from "../mailgun.js";

export async function sendOrderConfirmation(supabase, user, orderId) {
  // Email failures must never turn a committed order into a failed response.
  try {
    if (!user.email || !user.email_confirmed_at) return { status: "unavailable" };
    const { data, error } = await supabase.from("orders")
      .select("id,subtotal,special_instructions,order_items(quantity,unit_price,products(name))")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .single();
    if (error || !data?.order_items?.length) return { status: "unavailable" };
    await sendOrderEmail({ recipient: user.email, order: data });
    return { status: "queued" };
  } catch {
    return { status: "unavailable" };
  }
}
