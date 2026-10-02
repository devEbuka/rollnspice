import { formatPrice } from "@/lib/format";

export default function MenuItemCard({ product }) {
  const { name, description, price, category, featured } = product;

  return (
    <article className={`flex flex-col gap-3.5 bg-panel px-6 py-7 transition-colors duration-150 hover:bg-panel-hover ${featured ? "min-[561px]:col-span-2 min-[561px]:flex-row min-[561px]:items-center min-[561px]:gap-7" : ""}`}>
      {featured && (
        <div aria-hidden="true" className="size-[120px] shrink-0 rounded-[3px] bg-linear-to-br from-spice to-leaf" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-3.5 self-stretch">
        {category && <p className="text-xs font-medium text-spice capitalize">{category}</p>}
        <h3 className="font-display text-[21px] font-medium">{name}</h3>
        <p className="flex-1 text-sm text-muted">{description}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[17px] font-semibold tabular-nums">{formatPrice(price)}</span>
          <button type="button" aria-disabled="true" aria-label={`Add ${name} to cart`} className="rounded-[3px] border border-line px-4 py-2 text-[13px] font-medium transition-colors duration-150 hover:border-spice hover:bg-spice/10">
            Add to cart
          </button>
        </div>
      </div>
    </article>
  );
}
