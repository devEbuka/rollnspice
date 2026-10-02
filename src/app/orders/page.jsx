import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import Header from "@/components/layout/Header";
import OrderHistoryCard from "@/components/orders/OrderHistoryCard";
import { createClient, getUser } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/auth/return-path";

const PAGE_SIZE = 20;

export default async function Orders({ searchParams }) {
  const params = await searchParams;
  const number = Number(params.page ?? 1);
  const page = Number.isSafeInteger(number) && number > 0 && number <= 10000 ? number : 1;
  const returnTo = safeReturnPath(page === 1 ? "/orders" : `/orders?page=${page}`);
  const user = await getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  let orders = [];
  let failed = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("orders")
      .select("id,status,subtotal,special_instructions,created_at,order_items(id,quantity,unit_price,products(name))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    if (error) failed = true;
    else orders = data ?? [];
  } catch (error) {
    unstable_rethrow(error);
    failed = true;
  }
  const hasNext = orders.length > PAGE_SIZE;
  return (
    <>
      <a className="skip-link" href="#orders-main">Skip to order history</a>
      <Header />
      <main id="orders-main" tabIndex={-1} className="mx-auto w-full max-w-4xl px-[6vw] py-12 sm:py-20">
        <h1 className="mb-3 font-display text-4xl sm:text-5xl">Your orders</h1>
        <p className="mb-8 text-muted">Your order history, newest first.</p>
        {failed ? (
          <div role="alert" className="rounded-[3px] border border-line bg-panel p-6">
            <h2 className="mb-2 font-display text-xl">Order history is temporarily unavailable</h2>
            <p className="mb-4 text-muted">Please try again shortly.</p>
            <a href={returnTo} className="underline">Try again</a>
          </div>
        ) : orders.length ? (
          <div className="space-y-6">{orders.slice(0, PAGE_SIZE).map((order) => <OrderHistoryCard key={order.id} order={order} />)}</div>
        ) : (
          <section className="rounded-[3px] border border-line bg-panel p-6">
            <h2 className="mb-2 font-display text-xl">{page === 1 ? "No orders yet" : "No orders on this page"}</h2>
            <p className="text-muted">{page === 1 ? "Your placed orders will appear here." : "Go back to see your more recent orders."}</p>
          </section>
        )}
        {!failed && (page > 1 || hasNext) && <nav aria-label="Order history pages" className="mt-6 flex flex-wrap gap-6">
          {page > 1 && <Link href={`/orders?page=${page - 1}`} className="underline">Newer orders</Link>}
          {hasNext && <Link href={`/orders?page=${page + 1}`} className="underline">Older orders</Link>}
        </nav>}
        <Link href="/#menu" className="mt-8 inline-block underline">Back to the menu</Link>
      </main>
    </>
  );
}
