"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/lib/format";
import CartRow from "./CartRow";

export default function CartDrawer() {
  const { items, open, subtotal, closeCart, ready, pending, owner, error, message, refreshCart } = useCart();
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    // Removing a focused row must not strand keyboard focus on the page body.
    if (open && !dialog.contains(document.activeElement)) {
      dialog.querySelector("button")?.focus();
    }
  }, [items, open]);

  return (
    <dialog ref={dialogRef} id="cart-drawer" aria-labelledby="cart-title" onCancel={closeCart} onClose={closeCart} onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll("button:not(:disabled), a[href]")];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }} onClick={(event) => {
      if (event.target === dialogRef.current) {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeCart();
      }
    }} className="cart-drawer">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 id="cart-title" className="font-display text-[22px]">Your cart</h2>
          <button type="button" onClick={closeCart} aria-label="Close cart" className="size-9 text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-2">
          <p role="status" className="py-3 text-sm text-muted">{!ready ? "Loading your cart…" : pending ? `${pending} change(s) waiting to sync.` : owner ? "Account cart synced." : "Cart saved on this browser."} {message}</p>
          {error && <p role="alert" className="pb-3 text-sm text-spice">{error} <button type="button" onClick={refreshCart} className="underline">Retry sync</button></p>}
          {items.length ? <ul>{items.map((item) => <CartRow key={item.id} item={item} />)}</ul> : <p className="py-8 text-muted">Your cart is empty. Add something from the menu.</p>}
        </div>
        <div className="border-t border-line px-6 py-5">
          <div className="mb-4 flex justify-between"><span>Subtotal</span><strong className="text-lg tabular-nums" aria-live="polite" aria-atomic="true"><span className="sr-only">Cart subtotal: </span>{formatPrice(subtotal)}</strong></div>
          {items.length && ready && !pending && !error ? <Link href="/checkout" onClick={closeCart} className="block rounded-lg bg-spice py-[15px] text-center text-[15px] font-semibold text-white">Checkout</Link> : <button type="button" disabled className="w-full rounded-lg bg-spice py-[15px] font-semibold text-white opacity-50">Checkout</button>}
        </div>
      </div>
    </dialog>
  );
}
