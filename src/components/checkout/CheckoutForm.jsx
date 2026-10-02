"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useCart } from "@/hooks/useCart";
import { SPECIAL_INSTRUCTIONS_LIMIT } from "@/lib/constants";
import OrderSummary from "./OrderSummary";

const subscribe = () => () => {};

export default function CheckoutForm() {
  const { items, subtotal } = useCart();
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const [instructions, setInstructions] = useState("");

  // Wait for the persisted cart before deciding whether it is empty.
  if (!ready) return <p role="status" className="text-muted">Loading your cart…</p>;
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
      <form onSubmit={(event) => event.preventDefault()} className="rounded-[3px] border border-line bg-panel p-6">
        <h2 className="mb-6 font-display text-2xl">Special instructions</h2>
        <label htmlFor="special-instructions" className="mb-2 block text-sm font-semibold">Anything we should know? <span className="font-normal text-muted">(optional)</span></label>
        <textarea id="special-instructions" name="special_instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={SPECIAL_INSTRUCTIONS_LIMIT} rows={5} placeholder="e.g. no onions, extra spicy, call on arrival." aria-describedby="instructions-limit" className="w-full resize-y rounded-[3px] border border-line bg-panel px-3 py-3 text-base placeholder:text-muted" />
        <p id="instructions-limit" className="mt-2 text-sm text-muted">{instructions.length}/{SPECIAL_INSTRUCTIONS_LIMIT} characters</p>
        <button type="submit" disabled aria-describedby="order-availability" className="mt-8 w-full rounded-[3px] bg-spice px-5 py-3.5 font-semibold text-white opacity-50">Place order</button>
        <p id="order-availability" className="mt-3 text-sm text-muted">Ordering is not available yet. Your cart will stay saved.</p>
        <Link href="/#menu" className="mt-6 inline-block text-sm underline">Back to the menu</Link>
      </form>
    </div>
  );
}
