import Header from "@/components/layout/Header";
import MenuGrid from "@/components/menu/MenuGrid";
import { createClient } from "@/lib/supabase/server";
import { unstable_rethrow } from "next/navigation";

export default async function Home() {
  let products = [];
  let menuError = false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id,name,description,price,category,featured")
      .order("featured", { ascending: false })
      .order("name");

    if (error) menuError = true;
    else products = data ?? [];
  } catch (error) {
    unstable_rethrow(error);
    menuError = true;
  }

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main" tabIndex={-1}>
        <section id="about" className="max-w-[880px] px-[6vw] pt-[clamp(64px,11vw,160px)] pb-[7vw]">
          <p className="mb-[18px] text-sm font-medium text-spice">
            Flame-grilled · hand-rolled · Lagos
          </p>
          <h1 className="mb-6 max-w-[12ch] font-display text-[clamp(40px,6.5vw,76px)] leading-[1.02] font-semibold">
            Shawarma worth <em className="font-medium text-spice">the wait.</em>
          </h1>
          <p className="mb-9 max-w-[46ch] text-lg text-muted">
            Charcoal-grilled meat, house-made garlic sauce, wrapped fresh to
            order. No shortcuts, no microwave.
          </p>
          <a className="inline-block rounded-[3px] bg-ink px-7 py-3.5 text-[15px] font-semibold text-background" href="#menu">
            View the menu
          </a>
        </section>
        <MenuGrid products={products} error={menuError} />
      </main>
    </>
  );
}
