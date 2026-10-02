import { formatPrice } from "@/lib/format";
import AddToCartButton from "./AddToCartButton";
import Image from "next/image";
import { productImage } from "@/lib/product-images";

export default function MenuItemCard({ product }) {
  const { name, description, price, category, featured } = product;
  const photo = productImage(name);

  return (
    <article className={`menu-card ${featured ? "menu-card-featured" : ""}`}>
      {photo && <div className="menu-photo"><Image src={photo} alt="" width={1536} height={1024} sizes="(max-width: 560px) 100vw, (max-width: 860px) 50vw, 33vw" /></div>}
      <div className="menu-card-copy">
        {featured ? <p className="favourite-label">House favourite</p> : category && <p className="sr-only">{category}</p>}
        <h3 className="font-display text-[25px]">{name}</h3>
        <p className="flex-1 text-sm text-muted">{description}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <span className="font-display text-[25px] tabular-nums">{formatPrice(price)}</span>
          <AddToCartButton product={{ id: product.id, name, price }} />
        </div>
      </div>
    </article>
  );
}
