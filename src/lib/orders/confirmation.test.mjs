import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./confirmation.js", import.meta.url), "utf8")
  .replace('import "server-only";', "")
  .replace('import { sendOrderEmail } from "../mailgun.js";', "const sendOrderEmail = (...args) => globalThis.confirmationTestSend(...args);");
const { sendOrderConfirmation } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const user = { id: "session-owner", email: "verified@example.com", email_confirmed_at: "2026-10-02" };
const order = { id: "order-id", subtotal: 450000, order_items: [{ quantity: 1, unit_price: 450000 }] };
function database(error = null) {
  const filters = [];
  const query = { select: () => query, eq: (key, value) => { filters.push([key, value]); return query; }, single: async () => ({ data: order, error }) };
  return { from: (name) => { assert.equal(name, "orders"); return query; }, filters };
}

test("sends saved order details only to the server-verified user's email", async () => {
  const db = database();
  let sent;
  globalThis.confirmationTestSend = async (payload) => { sent = payload; };
  assert.deepEqual(await sendOrderConfirmation(db, user, order.id), { status: "queued" });
  assert.deepEqual(db.filters, [["id", order.id], ["user_id", user.id]]);
  assert.deepEqual(sent, { recipient: user.email, order });
});

test("unverified recipient, saved-order read failure and send failure remain nonfatal", async () => {
  globalThis.confirmationTestSend = async () => { throw new Error("provider failed"); };
  assert.deepEqual(await sendOrderConfirmation(database(), { ...user, email_confirmed_at: null }, order.id), { status: "unavailable" });
  assert.deepEqual(await sendOrderConfirmation(database({ message: "database failed" }), user, order.id), { status: "unavailable" });
  assert.deepEqual(await sendOrderConfirmation(database(), user, order.id), { status: "unavailable" });
});
