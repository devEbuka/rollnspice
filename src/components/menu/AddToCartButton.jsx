"use client";

import { useCart } from "@/hooks/useCart";

export default function AddToCartButton({ product }) {
  const { addItem } = useCart();
  return (
    <button type="button" onClick={() => addItem(product)} aria-label={`Add ${product.name} to cart`} className="rounded-[3px] border border-line px-4 py-2 text-[13px] font-medium transition-colors duration-150 hover:border-spice hover:bg-spice/10">
      Add to cart
    </button>
  );
}
