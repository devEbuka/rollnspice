"use client";

import { useCart } from "@/hooks/useCart";

export default function CartButton() {
  const { count, open, openCart } = useCart();
  return (
    <>
      <button type="button" onClick={openCart} aria-label={`Open cart, ${count} ${count === 1 ? "item" : "items"}`} aria-haspopup="dialog" aria-expanded={open} aria-controls="cart-drawer" className="cart-button">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2 3h3l3 13h11l3-10H6" /><circle cx="9" cy="21" r="1" /><circle cx="19" cy="21" r="1" /></svg> Cart
        <span aria-hidden="true" className="cart-count">({count})</span>
      </button>
      <span role="status" className="sr-only">Cart contains {count} {count === 1 ? "item" : "items"}.</span>
    </>
  );
}
