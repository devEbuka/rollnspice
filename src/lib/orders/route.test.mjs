import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { validateOrder } from "./validate.js";

globalThis.AsyncLocalStorage = AsyncLocalStorage;
const { NextResponse } = (await import("next/server.js")).default;
globalThis.orderTestResponse = NextResponse;
globalThis.orderTestValidate = validateOrder;
const source = fs.readFileSync(new URL("../../app/api/orders/route.js", import.meta.url), "utf8")
  .replace('import { NextResponse } from "next/server";', "const NextResponse = globalThis.orderTestResponse;")
  .replace('import { createClient } from "@/lib/supabase/server";', "const createClient = async () => globalThis.orderTestClient;")
  .replace('import { validateOrder } from "@/lib/orders/validate";', "const validateOrder = globalThis.orderTestValidate;");
const { POST } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const id = "12345678-1234-1234-1234-123456789012";
const body = { items: [{ product_id: id, quantity: 2, price: 1 }], user_id: "forged", subtotal: 1 };
const request = (payload = body) => new Request("http://localhost/api/orders", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
});
function client(result, user = { id: "verified-session-user" }) {
  let called;
  globalThis.orderTestClient = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    rpc: async (name, args) => { called = { name, args }; return result; },
  };
  return () => called;
}

test("unsigned requests and invalid orders never invoke the database write", async () => {
  const unsigned = client({}, null);
  assert.equal((await POST(request())).status, 401);
  assert.equal(unsigned(), undefined);
  const invalid = client({});
  assert.equal((await POST(request({ items: [] }))).status, 400);
  assert.equal(invalid(), undefined);
});

test("missing products report affected IDs instead of dropping items", async () => {
  client({ data: null, error: { message: "PRODUCTS_UNAVAILABLE", details: JSON.stringify([id]) } });
  const response = await POST(request());
  assert.equal(response.status, 409);
  assert.deepEqual((await response.json()).missingProductIds, [id]);
});

test("database failures return a recoverable message without SQL details", async () => {
  client({ data: null, error: { message: "internal SQL detail", code: "XX000" } });
  const response = await POST(request());
  assert.equal(response.status, 503);
  const result = await response.json();
  assert.match(result.error, /cart is saved/i);
  assert.doesNotMatch(result.error, /SQL/);
});

test("successful RPC accepts no client identity or monetary values", async () => {
  const called = client({ data: { id, subtotal: 900000, status: "pending" }, error: null });
  const response = await POST(request());
  assert.equal(response.status, 201);
  assert.deepEqual(called(), { name: "create_order", args: { p_items: [{ product_id: id, quantity: 2 }], p_special_instructions: null } });
  assert.equal((await response.json()).order.subtotal, 900000);
});
