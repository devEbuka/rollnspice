import test from "node:test";
import assert from "node:assert/strict";
import { orderEmailContent } from "./email-content.js";

const order = {
  id: "12345678-1234-1234-1234-123456789012", subtotal: 900000,
  special_instructions: '<script>alert("x")</script> & no onions',
  order_items: [{ quantity: 2, unit_price: 450000, products: { name: "Beef & <Roll>" } }],
};

test("receipt uses saved unit prices, quantities, total, instructions and reference", () => {
  const content = orderEmailContent(order);
  assert.match(content.subject, /12345678/);
  assert.match(content.text, /2 × Beef & <Roll> \(₦4,500 each\): ₦9,000/);
  assert.match(content.text, /Total: ₦9,000/);
  assert.ok(content.text.includes(order.special_instructions));
});

test("HTML escapes stored product names and user instructions", () => {
  const { html } = orderEmailContent(order);
  assert.ok(html.includes("Beef &amp; &lt;Roll&gt;"));
  assert.ok(html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; no onions"));
  assert.ok(!html.includes("<script>"));
});
