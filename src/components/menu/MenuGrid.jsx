import MenuItemCard from "./MenuItemCard";

export default function MenuGrid({ products, error = false }) {
  return (
    <section id="menu" aria-labelledby="menu-heading" className="scroll-mt-28 px-[6vw] pt-[5vw] pb-[8vw]">
      <div className="mb-10 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-5">
        <h2 id="menu-heading" className="font-display text-[30px]">The menu</h2>
        <p className="text-sm text-muted">Prices in ₦ · all wraps served hot</p>
      </div>
      {error ? (
        <div role="alert" className="border border-line bg-panel px-6 py-10">
          <h3 className="mb-2 font-display text-xl">The menu is temporarily unavailable</h3>
          <p className="text-muted">Please refresh the page or try again shortly.</p>
        </div>
      ) : products.length === 0 ? (
        <div role="status" className="border border-line bg-panel px-6 py-10">
          <h3 className="mb-2 font-display text-xl">No menu items available yet</h3>
          <p className="text-muted">Please check back soon for our freshly prepared menu.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-0.5 bg-line min-[561px]:grid-cols-2 min-[861px]:grid-cols-3">
          {products.map((product) => <MenuItemCard key={product.id} product={product} />)}
        </div>
      )}
    </section>
  );
}
