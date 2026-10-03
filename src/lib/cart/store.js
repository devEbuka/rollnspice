import { guest, saveGuest, pending, put, drop, optimistic, snapshot } from "./persistence.js";

export const initial = { items: [], open: false, owner: null, ready: false, pending: 0, revision: 0, message: "", error: "" };
export class CartStore {
  constructor(storage, rpc, lock = async (_, work) => work()) {
    this.storage = storage; this.rpc = rpc; this.lock = lock;
    this.state = initial; this.listeners = new Set(); this.epoch = 0; this.running = null; this.base = [];
  }
  subscribe = (listener) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.state;
  update(patch) { this.state = { ...this.state, ...patch }; this.listeners.forEach((fn) => fn()); }
  fail(error) {
    const message = error.message ?? "";
    const friendly = /^(Your account changed|Could not verify your account|Sync pending changes|This browser cannot|Choose up to)/.test(message)
      ? message : /storage|quota|saved cart/i.test(message)
        ? "Browser storage is unavailable or full. Your new change could not be saved; free some space and retry."
        : "Unable to sync right now. Saved changes will retry when you reconnect.";
    this.update({ error: friendly });
  }
  show() {
    const ops = pending(this.storage, this.state.owner);
    this.update({ items: optimistic(this.base, ops), pending: ops.length });
  }
  async identify(owner) {
    if (this.state.ready && owner === this.state.owner) return this.sync();
    const previous = this.state.owner; const epoch = ++this.epoch;
    this.base = []; this.update({ ...initial, open: this.state.open, owner });
    try {
      if (!owner) {
        if (previous) { saveGuest(this.storage, []); this.storage.removeItem("rollnspice-guest-claim"); }
        this.update({ items: guest(this.storage), ready: true });
        await this.catalogue(epoch); return;
      }
      await this.lock("rollnspice-guest-merge", async () => {
        if (epoch !== this.epoch) return;
        const items = previous ? [] : guest(this.storage);
        // A durable claim prevents another tab/account from re-merging these guest items.
        const claim = JSON.parse(this.storage.getItem("rollnspice-guest-claim") || "null");
        if (claim?.owner === owner && claim.op) put(this.storage, claim.op);
        if (items.length && !claim) {
          const op = { owner, id: crypto.randomUUID(), action: "merge", created: Date.now(),
            items: items.map((p) => ({ product_id: p.id, quantity: Math.min(99, p.quantity) })), products: items };
          this.storage.setItem("rollnspice-guest-claim", JSON.stringify({ owner, id: op.id, op }));
          put(this.storage, op);
          if (items.some((p) => p.quantity > 99)) this.update({ message: "Guest quantities above 99 were capped for your account cart." });
        }
      });
      if (epoch === this.epoch) await this.sync();
    } catch (error) { if (epoch === this.epoch) this.fail(error); }
  }
  async catalogue(epoch) {
    try {
      const result = await this.rpc("catalogue", {});
      if (epoch !== this.epoch || this.state.owner) return;
      if (result.error) throw result.error;
      const products = new Map(result.data.map((p) => [p.id, p]));
      const items = this.state.items.map((p) => ({ ...p, ...(products.get(p.id) ?? { price: 0 }), unavailable: !products.has(p.id) }));
      this.update({ items, message: items.some((p) => p.unavailable) ? "Some items are no longer on the menu. Remove them or review the account merge at sign-in." : "" });
    } catch {
      if (epoch === this.epoch) this.update({ message: "Menu refresh unavailable. Prices will be checked when you sign in and order." });
    }
  }
  async sync() {
    const owner = this.state.owner; const epoch = this.epoch;
    if (!owner) { try { this.update({ items: guest(this.storage) }); await this.catalogue(epoch); } catch (error) { this.fail(error); } return; }
    if (this.running?.epoch === epoch) { this.running.again = true; return this.running.promise; }
    const run = { epoch, again: false }; this.running = run;
    run.promise = this.lock(`rollnspice-cart-${owner}`, async () => {
      try {
        do {
          run.again = false;
          const fetched = await this.rpc("get_cart", {}, owner);
          if (epoch !== this.epoch) return;
          if (fetched.error) throw fetched.error;
          const data = snapshot(fetched.data); this.base = data.items;
          this.update({ revision: data.revision, ready: true, error: "" }); this.show();
          for (const op of pending(this.storage, owner)) {
            if (epoch !== this.epoch) return;
            const result = await this.rpc("mutate_cart", { p_operation_id: op.id, p_action: op.action,
              p_items: op.items, p_expected_revision: op.revision ?? null }, owner);
            if (epoch !== this.epoch) return;
            if (result.error) {
              if (op.action !== "merge" && (result.error.message === "CART_CONFLICT" || result.error.code === "22023")) {
                drop(this.storage, op);
                this.update({ message: result.error.message === "CART_CONFLICT"
                  ? "Your cart changed elsewhere. Review it before removing that item again."
                  : "That change could not be applied. Review menu availability and quantities." });
                run.again = true; continue;
              }
              throw result.error;
            }
            // Keep the receipt ID until acknowledgement; a lost response retries the identical request.
            if (op.action === "merge") {
              const claim = JSON.parse(this.storage.getItem("rollnspice-guest-claim") || "null");
              if (claim?.owner === owner && claim.id === op.id) {
                saveGuest(this.storage, []); this.storage.removeItem("rollnspice-guest-claim");
              }
            }
            drop(this.storage, op); run.again = true;
            if (result.data.adjustments?.length) this.update({ message: "Some quantities were capped at 99 or unavailable items were skipped. Review your cart." });
          }
        } while (run.again && epoch === this.epoch);
      } catch (error) {
        if (epoch === this.epoch) { try { this.show(); } catch { /* Preserve the last safe snapshot. */ } this.fail(error); }
      } finally { if (this.running === run) this.running = null; }
    });
    return run.promise;
  }
  edit(action, product, quantity = 1) {
    if (!this.state.ready) return;
    try {
      if (!this.state.owner) {
        const items = optimistic(this.state.items, [{ action, products: [product], items: [{ product_id: product.id, quantity }] }]);
        if (items.length > 100) throw new Error("Choose up to 100 different items.");
        saveGuest(this.storage, items); this.update({ items, error: "" }); return;
      }
      if (action === "remove" && this.state.pending) throw new Error("Sync pending changes before removing the whole item. You can still decrease its quantity.");
      const op = { owner: this.state.owner, id: crypto.randomUUID(), created: Date.now(), action,
        items: [{ product_id: product.id, quantity: action === "remove" ? 0 : quantity }], products: [product],
        ...(action === "remove" ? { revision: this.state.revision } : {}) };
      put(this.storage, op); this.show(); void this.sync();
    } catch (error) { this.fail(error); }
  }
}
