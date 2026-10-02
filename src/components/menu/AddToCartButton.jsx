"use client";

import { useCart } from "@/hooks/useCart";

export default function AddToCartButton({ product }) {
  const { addItem } = useCart();
  return (
    <button type="button" onClick={() => addItem(product)} aria-label={`Add ${product.name} to cart`} className="add-button">
      <svg aria-hidden="true" className="add-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 4v12M4 10h12" /></svg>
      <span>Add to cart</span>
    </button>
  );
}
