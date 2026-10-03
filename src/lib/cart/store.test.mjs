import test from "node:test";
import assert from "node:assert/strict";
import { CartStore } from "./store.js";
import { saveGuest, pending } from "./persistence.js";
import { checkoutRequest, validateCheckout } from "./checkout.js";

class Storage {
  data = new Map();
  get length() { return this.data.size; }
  key(i) { return [...this.data.keys()][i] ?? null; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
  removeItem(key) { this.data.delete(key); }
}
const product = { id: "a1000000-0000-0000-0000-000000000001", name: "Roll", price: 450000 };
function fixture() {
  const storage = new Storage(); let quantity = 0; let revision = 0; let offline = false; let loseReply = false;
  const receipts = new Map();
  const result = () => ({ revision, items: quantity ? [{ ...product, product_id: product.id, quantity }] : [] });
  const rpc = async (name, args) => {
    if (offline) return { error: { message: "Offline" } };
    if (name === "catalogue") return { data: [product] };
    if (name === "get_cart") return { data: result() };
    if (receipts.has(args.p_operation_id)) return { data: { ...receipts.get(args.p_operation_id), replayed: true } };
    if (args.p_expected_revision != null && args.p_expected_revision !== revision) return { error: { message: "CART_CONFLICT", code: "40001" } };
    const n = args.p_items[0].quantity;
    quantity = args.p_action === "remove" ? 0 : args.p_action === "decrement" ? Math.max(0, quantity - n) : Math.min(99, quantity + n);
    revision++; const data = { ...result(), adjustments: [] }; receipts.set(args.p_operation_id, data);
    if (loseReply) { loseReply = false; return { error: { message: "Reply lost" } }; }
    return { data };
  };
  return { storage, rpc, create: () => new CartStore(storage, rpc), result,
    offline: (value) => { offline = value; }, lose: () => { loseReply = true; }, receipts };
}
test("guest merge survives a lost reply and reload without doubling quantities", async () => {
  const f = fixture(); saveGuest(f.storage, [{ ...product, quantity: 2 }]); f.lose();
  const first = f.create(); await first.identify("one");
  assert.equal(f.result().items[0].quantity, 2); assert.equal(pending(f.storage, "one").length, 1);
  const restored = f.create(); await restored.identify("one");
  assert.equal(restored.state.items[0].quantity, 2); assert.equal(restored.state.pending, 0);
  assert.equal(f.receipts.size, 1); assert.deepEqual(JSON.parse(f.storage.getItem("rollnspice-cart")).items, []);
});
test("offline additions persist; retry and decrement at one remove the item", async () => {
  const f = fixture(); const store = f.create(); await store.identify("one"); f.offline(true);
  store.edit("add", product); await store.sync();
  assert.equal(store.state.items[0].quantity, 1); assert.equal(store.state.pending, 1);
  f.offline(false); await store.sync(); assert.equal(store.state.pending, 0);
  store.edit("decrement", product); await store.sync(); assert.deepEqual(store.state.items, []);
});
test("sign-out and another account cannot submit the first account's pending work", async () => {
  const f = fixture(); const store = f.create(); await store.identify("one"); f.offline(true);
  store.edit("add", product); await store.sync(); await store.identify(null);
  assert.deepEqual(store.state.items, []); assert.equal(pending(f.storage,"one").length, 1);
  await store.identify("two"); assert.equal(pending(f.storage,"two").length, 0);
  f.offline(false); await store.sync(); assert.deepEqual(store.state.items, []); assert.equal(f.receipts.size, 0);
});
test("stale absolute removal is rejected and the updated cart is restored", async () => {
  const f = fixture(); const store = f.create(); await store.identify("one");
  store.edit("add", product); await store.sync(); f.offline(true); store.edit("remove", product); await store.sync();
  f.offline(false); await f.rpc("mutate_cart",{p_operation_id:crypto.randomUUID(),p_action:"add",p_items:[{quantity:1}]});
  await store.sync(); assert.equal(store.state.items[0].quantity,2); assert.match(store.state.message,/changed elsewhere/);
});
test("late responses from the old owner cannot populate the new owner's view", async () => {
  const storage = new Storage(); let release;
  const blocked = new Promise((resolve)=>{release=resolve;});
  const store = new CartStore(storage, async (name)=>name === "catalogue" ? {data:[product]} : blocked);
  const old = store.identify("one"); await new Promise(r=>setImmediate(r));
  await store.identify(null); release({data:{revision:1,items:[{...product,product_id:product.id,quantity:3}]}}); await old;
  assert.equal(store.state.owner,null); assert.deepEqual(store.state.items,[]);
});
test("storage failure rejects an edit without pretending it was saved", async () => {
  const f = fixture(); const store=f.create(); await store.identify("one");
  f.storage.setItem=()=>{throw new Error("Storage full");}; store.edit("add",product);
  assert.deepEqual(store.state.items,[]); assert.match(store.state.error,/storage is unavailable or full/);
});
test("checkout replay preserves its original ID, revision, and instructions across reload",()=>{
  const storage=new Storage(); const body=checkoutRequest(storage,"one",2,"original");
  assert.deepEqual(checkoutRequest(storage,"one",99,"changed"),body);
  assert.notEqual(checkoutRequest(storage,"two",2,"original").cart_operation_id,body.cart_operation_id);
  assert.deepEqual(validateCheckout({...body,user_id:"forged",subtotal:1}),{p_operation_id:body.cart_operation_id,p_expected_revision:2,p_special_instructions:"original"});
});
