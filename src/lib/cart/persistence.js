import { CART_KEY, parseCart } from "../cart.js";

export const prefix = "rollnspice-account-cart:";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const guest = (storage) => parseCart(storage.getItem(CART_KEY));
export const saveGuest = (storage, items) => storage.setItem(CART_KEY, JSON.stringify({ version: 1, items }));
export const queuePrefix = (owner) => `${prefix}${owner}:op:`;

export function pending(storage, owner) {
  const operations = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(queuePrefix(owner))) continue;
    const op = JSON.parse(storage.getItem(key));
    if (op?.owner !== owner || !uuid.test(op.id) || !Number.isSafeInteger(op.created) ||
      !["add", "decrement", "remove", "merge"].includes(op.action) || !Array.isArray(op.items) || op.items.length > 100 ||
      op.items.some((p) => !uuid.test(p.product_id) || !Number.isInteger(p.quantity) || p.quantity < 0 || p.quantity > 99 ||
        (op.action === "remove" ? p.quantity !== 0 : p.quantity < 1)) ||
      (op.action === "remove" && (!Number.isSafeInteger(op.revision) || op.revision < 0))) throw new Error("Invalid saved cart request.");
    operations.push(op);
  }
  return operations.sort((a, b) => a.created - b.created || a.id.localeCompare(b.id));
}
export function put(storage, op) { storage.setItem(`${queuePrefix(op.owner)}${op.id}`, JSON.stringify(op)); }
export function drop(storage, op) { storage.removeItem(`${queuePrefix(op.owner)}${op.id}`); }

export function optimistic(items, operations) {
  const lines = new Map(items.map((line) => [line.id, { ...line }]));
  for (const op of operations) for (const input of op.items) {
    const old = lines.get(input.product_id);
    const quantity = op.action === "remove" ? 0 : op.action === "decrement"
      ? Math.max(0, (old?.quantity ?? 0) - input.quantity)
      : Math.min(99, (old?.quantity ?? 0) + input.quantity);
    if (!quantity) lines.delete(input.product_id);
    else if (old || op.products?.find((p) => p.id === input.product_id)) {
      lines.set(input.product_id, { ...(old ?? op.products.find((p) => p.id === input.product_id)), quantity });
    }
  }
  return [...lines.values()];
}

export function snapshot(data) {
  if (!Number.isSafeInteger(data?.revision) || data.revision < 0 || !Array.isArray(data.items)) throw new Error("Invalid cart response.");
  const items = parseCart(JSON.stringify({ version: 1, items: data.items.map((p) => ({ ...p, id: p.product_id })) }));
  if (items.length !== data.items.length || items.length > 100 || items.some((p) => p.quantity > 99)) throw new Error("Invalid cart response.");
  return { items, revision: data.revision };
}
