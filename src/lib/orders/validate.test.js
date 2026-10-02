import test from "node:test";
import assert from "node:assert/strict";
import { validateOrder } from "./validate.js";

const id = "12345678-1234-1234-ABCD-123456789012";
const item = { product_id: id, quantity: 2 };

test("normalizes IDs and accepts only product IDs, quantities, and instructions", () => {
  assert.deepEqual(validateOrder({
    items: [{ ...item, price: 1, user_id: "another user" }],
    user_id: "another user", subtotal: 2, special_instructions: " no onions ",
  }), { items: [{ product_id: id.toLowerCase(), quantity: 2 }], instructions: "no onions" });
});

test("rejects missing, invalid, duplicate, and oversized item lists", () => {
  for (const items of [null, [], [null], [{ ...item, product_id: "bad" }],
    [item, { ...item, product_id: id.toLowerCase() }], Array(101).fill(item)]) {
    assert.throws(() => validateOrder({ items }));
  }
});

test("rejects non-integer quantities and enforces bounds", () => {
  for (const quantity of [-1, 0, 1.5, "2", null, 100, Infinity]) {
    assert.throws(() => validateOrder({ items: [{ ...item, quantity }] }));
  }
  for (const quantity of [1, 99]) assert.equal(validateOrder({ items: [{ ...item, quantity }] }).items[0].quantity, quantity);
});

test("enforces the shared instructions limit without silently truncating", () => {
  assert.equal(validateOrder({ items: [item], special_instructions: "x".repeat(250) }).instructions.length, 250);
  assert.throws(() => validateOrder({ items: [item], special_instructions: "x".repeat(251) }));
  assert.throws(() => validateOrder({ items: [item], special_instructions: 10 }));
  assert.equal(validateOrder({ items: [item] }).instructions, null);
});
