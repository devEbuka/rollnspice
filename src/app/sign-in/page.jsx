import Link from "next/link";
import { redirect } from "next/navigation";
import AuthControls from "@/components/layout/AuthControls";
import { getUser } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/auth/return-path";

export default async function SignIn({ searchParams }) {
  const params = await searchParams;
  const next = safeReturnPath(params.next);
  if (await getUser()) redirect(next);

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-20">
      <Link href="/" className="font-display text-[22px] font-semibold">Roll N <span className="text-spice">Spice</span></Link>
      <h1 className="mt-10 mb-4 font-display text-4xl">Sign in to continue</h1>
      <p className="mb-8 text-muted">{next === "/checkout" ? "Sign in with Google to review your cart and continue to checkout." : "Use your Google account to continue."}</p>
      <AuthControls user={null} returnTo={next} />
      <Link href="/#menu" className="mt-8 inline-block text-sm underline">Back to the menu</Link>
    </main>
  );
}
