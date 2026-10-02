import { formatPrice } from "@/lib/format";

export default function OrderSummary({ items, subtotal }) {
  return (
    <section aria-labelledby="order-summary-title" className="rounded-xl border border-line bg-panel p-6">
      <h2 id="order-summary-title" className="mb-4 font-display text-2xl">Order summary</h2>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-4 py-4">
            <div className="min-w-0">
              <h3 className="font-semibold">{item.name}</h3>
              <p className="mt-1 text-sm text-muted">Quantity: {item.quantity} · {formatPrice(item.price)} each</p>
            </div>
            <span className="shrink-0 font-semibold tabular-nums">{formatPrice(item.price * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-between gap-4 border-t border-line pt-5">
        <span>Subtotal</span><strong className="text-lg tabular-nums">{formatPrice(subtotal)}</strong>
      </div>
    </section>
  );
}
