"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCart, getCartStore } from "@/hooks/useCart";
import { checkoutRequest, checkoutKey } from "@/lib/cart/checkout";
import { SPECIAL_INSTRUCTIONS_LIMIT } from "@/lib/constants";
import OrderSummary from "./OrderSummary";
import { formatPrice } from "@/lib/format";

export default function CheckoutForm() {
  const { items, subtotal, ready, owner, revision, pending, error: syncError, refreshCart } = useCart();
  let unfinished = false;
  try { unfinished = ready && owner && Boolean(localStorage.getItem(checkoutKey(owner))); } catch { /* Submission reports persistence failure. */ }
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);
  const submitting = useRef(false);
  const resultRef = useRef(null);
  const errorRef = useRef(null);

  useEffect(() => {
    if (order) resultRef.current?.focus();
    else if (error) errorRef.current?.focus();
  }, [order, error]);

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || !ready || !owner || pending || syncError) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const submittedOwner = owner;
    try {
      const body = checkoutRequest(localStorage, owner, revision, instructions);
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Cart-Account": owner },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (getCartStore().state.owner !== submittedOwner) return;
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) localStorage.removeItem(checkoutKey(owner));
        if (result.conflict) await refreshCart();
        throw new Error(result.error || "Could not confirm your order. Retry the same saved request.");
      }
      if (!result.order?.id || !Number.isSafeInteger(result.order.subtotal)) throw new Error("Could not confirm your order. Your cart is saved.");
      localStorage.removeItem(checkoutKey(owner));
      setOrder({ ...result.order, owner });
      setEmailStatus(result.email?.status);
      await refreshCart();
    } catch (failure) {
      if (getCartStore().state.owner === submittedOwner) setError(failure.message === "Failed to fetch" ? "Connection lost. Retry to confirm the same order; it will not be placed twice." : failure.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  // Wait for the persisted cart before deciding whether it is empty.
  if (!ready) return <p role="status" className="text-muted">Loading your cart…</p>;
  if (order && order.owner === owner) return (
    <section ref={resultRef} tabIndex={-1} aria-labelledby="order-result-title" className="rounded-xl border border-line bg-panel p-6 sm:p-8">
      <h2 id="order-result-title" className="mb-3 font-display text-2xl">Order placed</h2>
      <p className="mb-2 break-all text-sm text-muted">Order reference: {order.id}</p>
      <p className="mb-6">Total: <strong>{formatPrice(order.subtotal)}</strong></p>
      <p className="mb-6 text-muted">{emailStatus === "queued" ? "Confirmation email queued. Check your inbox or spam folder." : emailStatus === "already_processed" ? "Your original order is confirmed. Check your inbox or order history for its details." : "Order placed, email unavailable. Your order is saved; please do not place it again."}</p>
      <Link href="/#menu" className="inline-block rounded-lg bg-ink px-5 py-3 font-semibold text-background">Back to the menu</Link>
    </section>
  );
  if (!items.length && !unfinished) return (
    <section className="rounded-xl border border-line bg-panel p-6 sm:p-8">
      <h2 className="mb-3 font-display text-2xl">Your cart is empty</h2>
      <p className="mb-6 text-muted">Add something from the menu before checking out.</p>
      <Link href="/#menu" className="inline-block rounded-lg bg-ink px-5 py-3 font-semibold text-background">Back to the menu</Link>
    </section>
  );

  return (
    <div className="grid items-start gap-6 min-[761px]:grid-cols-2">
      <p role="status" className="sr-only">{busy ? "Placing your order. Please wait." : ""}</p>
      <OrderSummary items={items} subtotal={subtotal} />
      <form onSubmit={submit} aria-busy={busy} className="rounded-xl border border-line bg-panel p-6">
        {unfinished && <p role="status" className="mb-4 text-sm">A saved order request needs confirmation. Retry uses its original quantities and instructions. The summary shows your current cart, which may have changed since that request.</p>}
        {(pending > 0 || syncError) && <p role="status" className="mb-4 text-sm text-spice">Sync your cart before ordering. {syncError} <button type="button" onClick={refreshCart} className="underline">Retry sync</button></p>}
        <h2 className="mb-6 font-display text-2xl">Special instructions</h2>
        <label htmlFor="special-instructions" className="mb-2 block text-sm font-semibold">Anything we should know? <span className="font-normal text-muted">(optional)</span></label>
        <textarea disabled={busy || unfinished} id="special-instructions" name="special_instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={SPECIAL_INSTRUCTIONS_LIMIT} rows={5} placeholder="e.g. no onions, extra spicy, call on arrival." aria-describedby="instructions-limit" className="w-full resize-y rounded-lg border border-muted bg-panel px-3 py-3 text-base placeholder:text-muted" />
        <p id="instructions-limit" className="mt-2 text-sm text-muted">{instructions.length}/{SPECIAL_INSTRUCTIONS_LIMIT} characters</p>
        <button type="submit" disabled={busy || !owner || pending > 0 || Boolean(syncError)} className="mt-8 w-full rounded-lg bg-spice px-5 py-3.5 font-semibold text-white disabled:opacity-50">{busy ? "Placing order…" : unfinished ? "Confirm saved order" : "Place order"}</button>
        {error && <p ref={errorRef} tabIndex={-1} role="alert" className="mt-3 text-sm text-spice">{error}</p>}
        <Link href="/#menu" className="mt-6 inline-block text-sm underline">Back to the menu</Link>
      </form>
    </div>
  );
}
