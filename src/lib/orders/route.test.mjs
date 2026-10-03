import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { validateOrder } from "./validate.js";
import { validateCheckout } from "../cart/checkout.js";

globalThis.AsyncLocalStorage = AsyncLocalStorage;
const { NextResponse } = (await import("next/server.js")).default;
globalThis.orderTestResponse = NextResponse;
globalThis.orderTestValidate = validateOrder;
globalThis.orderTestCheckout = validateCheckout;
globalThis.orderTestEmailStatus = "queued";
const httpSource = fs.readFileSync(new URL("./http.js", import.meta.url), "utf8")
  .replace('import { NextResponse } from "next/server";', "const NextResponse = globalThis.orderTestResponse;");
const { reply } = await import(`data:text/javascript;base64,${Buffer.from(httpSource).toString("base64")}`);
globalThis.orderTestReply = reply;
const sessionSource = fs.readFileSync(new URL("./session.js", import.meta.url), "utf8")
  .replace('import { createRequestClient } from "@/lib/supabase/request";', `const createRequestClient = async (request) => {
    globalThis.orderTestAuthorization = request.headers.get("authorization");
    return { supabase: globalThis.orderTestClient, token: globalThis.orderTestAuthorization?.slice(7) };
  };`)
  .replace('import { reply } from "./http";', "const reply = globalThis.orderTestReply;");
const { orderSession } = await import(`data:text/javascript;base64,${Buffer.from(sessionSource).toString("base64")}`);
globalThis.orderTestSession = orderSession;
const source = fs.readFileSync(new URL("../../app/api/orders/route.js", import.meta.url), "utf8")
  .replace('import { NextResponse } from "next/server";', "const NextResponse = globalThis.orderTestResponse;")
  .replace('import { orderSession } from "@/lib/orders/session";', "const orderSession = globalThis.orderTestSession;")
  .replace('import { reply } from "@/lib/orders/http";', "const reply = globalThis.orderTestReply;")
  .replace('import { validateOrder } from "@/lib/orders/validate";', "const validateOrder = globalThis.orderTestValidate;")
  .replace('import { sendOrderConfirmation } from "@/lib/orders/confirmation";', "const sendOrderConfirmation = async () => { globalThis.orderTestEmailCalls = (globalThis.orderTestEmailCalls ?? 0) + 1; return {status: globalThis.orderTestEmailStatus}; };")
  .replace('import { validateCheckout } from "@/lib/cart/checkout";', "const validateCheckout = globalThis.orderTestCheckout;");
const { POST, GET } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
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

test("email failure keeps the committed order successful and visible", async () => {
  globalThis.orderTestEmailStatus = "unavailable";
  client({ data: { id, subtotal: 900000, status: "pending" }, error: null });
  const response = await POST(request());
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { order: { id, subtotal: 900000, status: "pending" }, email: { status: "unavailable" }, replayed: false });
  globalThis.orderTestEmailStatus = "queued";
});

const sharedBody = { cart_operation_id: id, cart_revision: 7, special_instructions: "no onions", user_id: "forged", subtotal: 1 };
test("shared checkout sends only its operation, revision and instructions", async () => {
  const called = client({data:{order:{id,subtotal:450000},replayed:false},error:null});
  assert.equal((await POST(request(sharedBody))).status,201);
  assert.deepEqual(called(),{name:"checkout_cart",args:{p_operation_id:id,p_expected_revision:7,p_special_instructions:"no onions"}});
});
test("replayed checkout does not send another confirmation email", async () => {
  client({data:{order:{id,subtotal:450000},replayed:true},error:null});
  const before=globalThis.orderTestEmailCalls;
  const response=await POST(request(sharedBody));
  assert.equal(response.status,201); assert.equal(globalThis.orderTestEmailCalls,before);
  assert.equal((await response.json()).email.status,"already_processed");
});
test("stale shared checkout requires cart review", async () => {
  client({error:{message:"CART_CONFLICT",code:"40001"}});
  const response=await POST(request(sharedBody)); assert.equal(response.status,409);
  assert.equal((await response.json()).conflict,true);
});
test("invalid shared checkout does not call the database", async () => {
  const called=client({}); assert.equal((await POST(request({...sharedBody,cart_revision:-1}))).status,400); assert.equal(called(),undefined);
});

const mobileRequest = (payload = sharedBody, extra = {}) => new Request("http://localhost/api/orders", {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer mobile-token", ...extra }, body: JSON.stringify(payload),
});
test("mobile token is verified and checkout remains retry-safe", async () => {
  const called = client({ data: { order: { id, subtotal: 450000 }, replayed: false }, error: null });
  let token;
  globalThis.orderTestClient.auth.getUser = async (jwt) => { token = jwt; return { data: { user: { id: "mobile-owner" } }, error: null }; };
  const response = await POST(mobileRequest());
  assert.equal(response.status, 201); assert.equal(token, "mobile-token");
  assert.equal(called().name, "checkout_cart");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("vary"), "Authorization, Cookie");
});
test("invalid mobile tokens, owner mismatch and legacy mobile orders cannot write", async () => {
  for (const status of [400, 401, 403]) {
    const called = client({});
    globalThis.orderTestClient.auth.getUser = async () => ({ data: { user: null }, error: { status } });
    assert.equal((await POST(mobileRequest())).status, 401); assert.equal(called(), undefined);
  }
  let called = client({});
  assert.equal((await POST(mobileRequest(sharedBody, { "X-Cart-Account": "different-owner" }))).status, 409);
  assert.equal(called(), undefined);
  called = client({});
  assert.equal((await POST(mobileRequest(body))).status, 400); assert.equal(called(), undefined);
});
test("authentication outages and foreign origins never write", async () => {
  const called = client({});
  globalThis.orderTestClient.auth.getUser = async () => ({ data: { user: null }, error: { status: 500 } });
  assert.equal((await POST(mobileRequest())).status, 503);
  assert.equal((await POST(mobileRequest(sharedBody, { Origin: "https://foreign.example" }))).status, 403);
  assert.equal(called(), undefined);
});
test("history filters the verified owner, paginates and ignores forged identity", async () => {
  client({}); const calls = [];
  const rows = Array.from({ length: 21 }, (_, i) => ({ id: String(i) }));
  const query = {};
  for (const method of ["select", "eq", "order"]) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  query.range = async (...args) => { calls.push(["range", ...args]); return { data: rows, error: null }; };
  globalThis.orderTestClient.from = (table) => { assert.equal(table, "orders"); return query; };
  const response = await GET(new Request("http://localhost/api/orders?page=2&user_id=forged", { headers: { Authorization: "Bearer mobile-token" } }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls.find(([method]) => method === "eq"), ["eq", "user_id", "verified-session-user"]);
  assert.deepEqual(calls.at(-1), ["range", 20, 40]);
  const result = await response.json(); assert.equal(result.orders.length, 20); assert.equal(result.hasNext, true); assert.equal(result.page, 2);
});
test("unsigned or invalid history does not query and failures hide database details", async () => {
  client({}, null);
  assert.equal((await GET(new Request("http://localhost/api/orders"))).status, 401);
  client({}); globalThis.orderTestClient.from = () => { throw new Error("must not query"); };
  for (const page of ["0", "-1", "1.5", "10001", "abc", ""]) {
    assert.equal((await GET(new Request(`http://localhost/api/orders?page=${page}`))).status, 400);
  }
  const response = await GET(new Request("http://localhost/api/orders"));
  assert.equal(response.status, 503); assert.doesNotMatch((await response.json()).error, /must not query/);
});
