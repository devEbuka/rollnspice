"use client";
import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { CartStore, initial } from "@/lib/cart/store";

let store;
const noop = () => () => {};
export function getCartStore() {
  if (!store && typeof window !== "undefined") {
    const client = createClient();
    const lock = (name, work) => {
      if (navigator.locks) return navigator.locks.request(name, work);
      if (name === "rollnspice-guest-merge") throw new Error("This browser cannot safely merge carts across tabs. Use an updated browser.");
      return work();
    };
    const storage = {
      get length() { return window.localStorage.length; }, key: (i) => window.localStorage.key(i),
      getItem: (key) => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value),
      removeItem: (key) => window.localStorage.removeItem(key),
    };
    store = new CartStore(storage, async (name, args, owner) => {
      if (name === "catalogue") return client.from("products").select("id,name,price");
      // Queue ownership is local isolation; the database still authorizes the actual token.
      const { data } = await client.auth.getSession();
      if (data.session?.user?.id !== owner) return { error: new Error("Your account changed. Pending changes stay with their original account.") };
      return client.rpc(name, args).setHeader("Authorization", `Bearer ${data.session.access_token}`);
    }, lock);
  }
  return store;
}
export function CartConnection() {
  useEffect(() => {
    const cart = getCartStore(); const client = createClient(); let channel; let active = true; let generation = 0;
    async function identify(session) {
      const token = ++generation;
      // Hide old-account data before doing any asynchronous verification.
      if (cart.state.owner !== (session?.user?.id ?? null)) {
        cart.epoch++; cart.base = []; cart.update({ ...initial, owner: cart.state.owner, open: cart.state.open });
      }
      const { data, error } = await client.auth.getUser();
      if (!active || token !== generation) return;
      if (error && session) { cart.fail(new Error("Could not verify your account. Reconnect and retry.")); return; }
      const owner = data.user?.id ?? null;
      if (channel) { void client.removeChannel(channel); channel = null; }
      await cart.identify(owner);
      if (!active || token !== generation || !owner) return;
      channel = client.channel(`cart:${owner}`).on("postgres_changes", {
        event: "*", schema: "public", table: "carts", filter: `user_id=eq.${owner}`,
      }, () => void cart.sync()).subscribe((status) => {
        if (status === "SUBSCRIBED") void cart.sync();
      });
    }
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) {
        // Supabase auth callback must return before invoking another auth method.
        if (cart.state.owner !== (session?.user?.id ?? null)) {
          cart.epoch++; cart.base = []; cart.update({ ...initial, owner: cart.state.owner, open: cart.state.open });
        }
        setTimeout(() => { if (active) void identify(session); }, 0);
      }
    });
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (cart.state.ready) void cart.sync();
      else void client.auth.getSession().then(({ data }) => identify(data.session));
    };
    const storage = (event) => { if (event.key?.startsWith("rollnspice") || event.key === null) void cart.sync(); };
    window.addEventListener("online", refresh); window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      active = false; generation++; subscription.unsubscribe();
      if (channel) void client.removeChannel(channel);
      window.removeEventListener("online", refresh); window.removeEventListener("storage", storage);
      document.removeEventListener("visibilitychange", refresh); clearInterval(timer);
    };
  }, []);
  return null;
}
export function useCart() {
  const cart = getCartStore();
  const state = useSyncExternalStore(cart?.subscribe ?? noop, cart?.getSnapshot ?? (() => initial), () => initial);
  return { ...state,
    count: state.items.reduce((sum, p) => sum + p.quantity, 0),
    subtotal: state.items.reduce((sum, p) => sum + p.price * p.quantity, 0),
    addItem: (product) => cart?.edit("add", product),
    changeQuantity: (id, delta) => { const item = state.items.find((p) => p.id === id); if (item) cart?.edit(delta < 0 ? "decrement" : "add", item, Math.abs(delta)); },
    removeItem: (id) => { const item = state.items.find((p) => p.id === id); if (item) cart?.edit("remove", item); },
    refreshCart: () => cart?.sync(),
    openCart: () => cart?.update({ open: true }), closeCart: () => cart?.update({ open: false }),
  };
}
