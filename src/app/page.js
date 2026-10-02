import Hero from "@/components/layout/Hero";
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
        <Hero />
        <MenuGrid products={products} error={menuError} />
      </main>
    </>
  );
}
