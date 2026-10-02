"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useCart } from "@/hooks/useCart";
import { SPECIAL_INSTRUCTIONS_LIMIT } from "@/lib/constants";
import OrderSummary from "./OrderSummary";
import { formatPrice } from "@/lib/format";

const subscribe = () => () => {};

export default function CheckoutForm() {
  const { items, subtotal, completeOrder } = useCart();
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);
  const submitting = useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const submitted = items.map((item) => ({ ...item }));
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: submitted.map((item) => ({ product_id: item.id, quantity: item.quantity })), special_instructions: instructions }),
      });
      const result = await response.json();
      if (!response.ok) {
        const missing = Array.isArray(result.missingProductIds) ? submitted.filter((item) => result.missingProductIds.includes(item.id)).map((item) => item.name) : [];
        throw new Error(`${result.error || "Could not place your order."}${missing.length ? ` Unavailable: ${missing.join(", ")}.` : ""}`);
      }
      if (!result.order?.id || !Number.isSafeInteger(result.order.subtotal)) throw new Error("Could not confirm your order. Your cart is saved.");
      setOrder(result.order);
      setEmailStatus(result.email?.status === "queued" ? "queued" : "unavailable");
      completeOrder(submitted);
    } catch (failure) {
      setError(failure.message === "Failed to fetch" ? "Could not confirm your order. Your cart is saved; check before retrying." : failure.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  // Wait for the persisted cart before deciding whether it is empty.
  if (!ready) return <p role="status" className="text-muted">Loading your cart…</p>;
  if (order) return (
    <section role="status" className="rounded-[3px] border border-line bg-panel p-6 sm:p-8">
      <h2 className="mb-3 font-display text-2xl">Order placed</h2>
      <p className="mb-2 break-all text-sm text-muted">Order reference: {order.id}</p>
      <p className="mb-6">Total: <strong>{formatPrice(order.subtotal)}</strong></p>
      <p className="mb-6 text-muted">{emailStatus === "queued" ? "Confirmation email queued. Check your inbox or spam folder." : "Order placed, email unavailable. Your order is saved; please do not place it again."}</p>
      <Link href="/#menu" className="inline-block rounded-[3px] bg-ink px-5 py-3 font-semibold text-background">Back to the menu</Link>
    </section>
  );
  if (!items.length) return (
    <section className="rounded-[3px] border border-line bg-panel p-6 sm:p-8">
      <h2 className="mb-3 font-display text-2xl">Your cart is empty</h2>
      <p className="mb-6 text-muted">Add something from the menu before checking out.</p>
      <Link href="/#menu" className="inline-block rounded-[3px] bg-ink px-5 py-3 font-semibold text-background">Back to the menu</Link>
    </section>
  );

  return (
    <div className="grid items-start gap-6 min-[761px]:grid-cols-2">
      <OrderSummary items={items} subtotal={subtotal} />
      <form onSubmit={submit} aria-busy={busy} className="rounded-[3px] border border-line bg-panel p-6">
        <h2 className="mb-6 font-display text-2xl">Special instructions</h2>
        <label htmlFor="special-instructions" className="mb-2 block text-sm font-semibold">Anything we should know? <span className="font-normal text-muted">(optional)</span></label>
        <textarea id="special-instructions" name="special_instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={SPECIAL_INSTRUCTIONS_LIMIT} rows={5} placeholder="e.g. no onions, extra spicy, call on arrival." aria-describedby="instructions-limit" className="w-full resize-y rounded-[3px] border border-line bg-panel px-3 py-3 text-base placeholder:text-muted" />
        <p id="instructions-limit" className="mt-2 text-sm text-muted">{instructions.length}/{SPECIAL_INSTRUCTIONS_LIMIT} characters</p>
        <button type="submit" disabled={busy} className="mt-8 w-full rounded-[3px] bg-spice px-5 py-3.5 font-semibold text-white disabled:opacity-50">{busy ? "Placing order…" : "Place order"}</button>
        {error && <p role="alert" className="mt-3 text-sm text-spice">{error} Your cart has not been cleared.</p>}
        <Link href="/#menu" className="mt-6 inline-block text-sm underline">Back to the menu</Link>
      </form>
    </div>
  );
}
