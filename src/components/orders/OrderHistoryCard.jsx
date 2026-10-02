import { formatPrice } from "@/lib/format";

const dateFormat = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos",
});

export default function OrderHistoryCard({ order }) {
  // Database timestamps are stored without a timezone, using UTC.
  const timestamp = /(?:Z|[+-]\d{2}:\d{2})$/.test(order.created_at)
    ? order.created_at : `${order.created_at}Z`;
  const date = new Date(timestamp);
  return (
    <article aria-labelledby={`order-${order.id}`} className="rounded-[3px] border border-line bg-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`order-${order.id}`} className="break-all font-display text-xl">Order {order.id}</h2>
          <p className="mt-2 text-sm text-muted">{Number.isNaN(date.getTime()) ? "Date unavailable" : <><time dateTime={timestamp}>{dateFormat.format(date)}</time> · Lagos time</>}</p>
        </div>
        <p className="text-sm font-semibold capitalize">Status: {order.status}</p>
      </div>
      <ul className="mt-4 divide-y divide-line">
        {order.order_items.map((item) => (
          <li key={item.id} className="flex flex-wrap justify-between gap-3 py-3">
            <div>
              <h3 className="font-semibold">{item.products?.name || "Menu item unavailable"}</h3>
              <p className="text-sm text-muted">Quantity: {item.quantity} · {formatPrice(item.unit_price)} each</p>
            </div>
            <span className="font-semibold tabular-nums">{formatPrice(item.unit_price * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-line pt-4">Total: <strong>{formatPrice(order.subtotal)}</strong></p>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm text-muted"><span className="font-semibold text-ink">Special instructions: </span>{order.special_instructions || "None"}</p>
    </article>
  );
}
