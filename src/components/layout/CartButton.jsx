"use client";

import { useCart } from "@/hooks/useCart";

export default function CartButton() {
  const { count, open, openCart } = useCart();
  return (
    <>
      <button type="button" onClick={openCart} aria-label={`Open cart, ${count} ${count === 1 ? "item" : "items"}`} aria-haspopup="dialog" aria-expanded={open} aria-controls="cart-drawer" className="relative rounded-[3px] bg-ink px-4 py-2.5 font-semibold text-background">
        Cart
        <span aria-hidden="true" className="absolute -top-2 -right-2 flex min-w-5 items-center justify-center rounded-full bg-spice px-1 text-[11px] leading-5 text-white">{count}</span>
      </button>
      <span role="status" className="sr-only">Cart contains {count} {count === 1 ? "item" : "items"}.</span>
    </>
  );
}
