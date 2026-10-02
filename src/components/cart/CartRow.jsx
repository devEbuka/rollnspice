"use client";

import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/lib/format";

export default function CartRow({ item }) {
  const { changeQuantity, removeItem } = useCart();
  return (
    <li className="flex gap-3.5 border-b border-line py-4">
      <div aria-hidden="true" className="size-14 shrink-0 rounded-[3px] bg-linear-to-br from-spice to-leaf" />
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold">{item.name}</h3>
        <p className="text-xs text-muted">{formatPrice(item.price)} each</p>
        <div className="mt-2 flex items-center gap-2.5">
          <button type="button" aria-label={item.quantity === 1 ? `Remove ${item.name} by decreasing quantity` : `Decrease ${item.name} quantity`} onClick={() => changeQuantity(item.id, -1)} className="size-7 rounded-[3px] border border-line">−</button>
          <span aria-label={`${item.name} quantity`} className="min-w-4 text-center text-sm">{item.quantity}</span>
          <button type="button" aria-label={`Increase ${item.name} quantity`} onClick={() => changeQuantity(item.id, 1)} className="size-7 rounded-[3px] border border-line">+</button>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-sm font-semibold tabular-nums">{formatPrice(item.price * item.quantity)}</span>
        <button type="button" aria-label={`Remove ${item.name} from cart`} onClick={() => removeItem(item.id)} className="px-1 text-sm text-muted underline">Remove</button>
      </div>
    </li>
  );
}
