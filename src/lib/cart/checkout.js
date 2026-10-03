import { prefix } from "./persistence.js";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateCheckout(body) {
  if (!uuid.test(body?.cart_operation_id) || !Number.isSafeInteger(body.cart_revision) || body.cart_revision < 0) {
    throw new Error("Refresh your cart before ordering.");
  }
  const instructions = body.special_instructions ?? "";
  if (typeof instructions !== "string" || instructions.length > 250) throw new Error("Special instructions must be 250 characters or fewer.");
  return { p_operation_id: body.cart_operation_id, p_expected_revision: body.cart_revision, p_special_instructions: instructions.trim() || null };
}
export const checkoutKey = (owner) => `${prefix}${owner}:checkout`;
export function checkoutRequest(storage, owner, revision, instructions) {
  const key = checkoutKey(owner); const old = storage.getItem(key);
  if (old) return JSON.parse(old);
  const body = { cart_operation_id: crypto.randomUUID(), cart_revision: revision, special_instructions: instructions };
  storage.setItem(key, JSON.stringify(body));
  return body;
}
