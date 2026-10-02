export const CART_KEY = "rollnspice-cart";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseCart(raw) {
  try {
    const cart = JSON.parse(raw);
    if (cart?.version !== 1 || !Array.isArray(cart.items)) return [];
    const ids = new Set();
    for (const item of cart.items) {
      if (!item || !uuid.test(item.id) || ids.has(item.id) ||
        typeof item.name !== "string" || !item.name.trim() ||
        !Number.isSafeInteger(item.price) || item.price < 0 ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
        !Number.isSafeInteger(item.price * item.quantity)) return [];
      ids.add(item.id);
    }
    if (!Number.isSafeInteger(cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0))) return [];
    if (!Number.isSafeInteger(cart.items.reduce((sum, item) => sum + item.quantity, 0))) return [];
    return cart.items.map(({ id, name, price, quantity }) => ({ id, name, price, quantity }));
  } catch {
    return [];
  }
}
