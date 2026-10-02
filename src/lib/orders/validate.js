import { SPECIAL_INSTRUCTIONS_LIMIT } from "../constants.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateOrder(body) {
  if (!body || !Array.isArray(body.items) || !body.items.length || body.items.length > 100) {
    throw new Error("Choose between 1 and 100 distinct menu items.");
  }
  const ids = new Set();
  const items = body.items.map((item) => {
    if (typeof item?.product_id !== "string" || !uuid.test(item.product_id)) throw new Error("A cart item has an invalid product ID.");
    const id = item.product_id.toLowerCase();
    if (ids.has(id)) throw new Error("Each product must appear once in the order.");
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new Error("Each item needs a quantity between 1 and 99.");
    ids.add(id);
    return { product_id: id, quantity: item.quantity };
  });
  const instructions = body.special_instructions ?? "";
  if (typeof instructions !== "string" || instructions.length > SPECIAL_INSTRUCTIONS_LIMIT) {
    throw new Error(`Special instructions must be ${SPECIAL_INSTRUCTIONS_LIMIT} characters or fewer.`);
  }
  // Discard all client identity, price, subtotal, and other untrusted fields.
  return { items, instructions: instructions.trim() || null };
}
