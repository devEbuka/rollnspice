import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

let cookieCalls = 0; const clients = [];
globalThis.requestTestCookie = async () => { cookieCalls++; return { kind: "cookie" }; };
globalThis.requestTestCreate = (url, key, options) => { const client = { url, key, options }; clients.push(client); return client; };
const source = fs.readFileSync(new URL("./request.js", import.meta.url), "utf8")
  .replace('import "server-only";', "")
  .replace('import { createClient as createSupabaseClient } from "@supabase/supabase-js";', "const createSupabaseClient = globalThis.requestTestCreate;")
  .replace('import { createClient as createCookieClient } from "./server";', "const createCookieClient = globalThis.requestTestCookie;");
const { createRequestClient } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
test("cookie requests retain the existing helper; bearer tokens use isolated clients", async () => {
  assert.equal((await createRequestClient(new Request("http://localhost"))).supabase.kind, "cookie");
  const before = cookieCalls;
  const a = await createRequestClient(new Request("http://localhost", { headers: { Authorization: "Bearer token-a", Cookie: "other-session" } }));
  const b = await createRequestClient(new Request("http://localhost", { headers: { Authorization: "bearer token-b" } }));
  assert.equal(cookieCalls, before); assert.notEqual(a.supabase, b.supabase);
  assert.equal(a.token, "token-a"); assert.equal(b.token, "token-b");
  assert.deepEqual(a.supabase.options, { global: { headers: { Authorization: "Bearer token-a" } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
});
test("malformed authorization never falls back to cookie authentication", async () => {
  const before = cookieCalls; const count = clients.length;
  for (const value of ["", "Basic token", "Bearer", "Bearer a b", "Bearer a,Bearer b", "Bearer " + "a".repeat(8193)]) {
    await assert.rejects(createRequestClient(new Request("http://localhost", { headers: { Authorization: value, Cookie: "valid-cookie" } })), { status: 401 });
  }
  assert.equal(cookieCalls, before); assert.equal(clients.length, count);
});
