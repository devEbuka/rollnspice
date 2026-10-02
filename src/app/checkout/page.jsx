import { redirect } from "next/navigation";
import Header from "@/components/layout/Header";
import CheckoutForm from "@/components/checkout/CheckoutForm";
import { getUser } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/auth/return-path";

export default async function Checkout() {
  const user = await getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(safeReturnPath("/checkout"))}`);

  return (
    <>
      <a className="skip-link" href="#checkout-main">Skip to checkout</a>
      <Header />
      <main id="checkout-main" tabIndex={-1} className="mx-auto w-full max-w-5xl px-[6vw] py-12 sm:py-20">
        <h1 className="mb-8 font-display text-4xl sm:text-5xl">Checkout</h1>
        <CheckoutForm />
      </main>
    </>
  );
}
