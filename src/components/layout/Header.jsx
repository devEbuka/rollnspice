import Link from "next/link";
import AuthControls from "./AuthControls";
import CartButton from "./CartButton";
import { getUser } from "@/lib/supabase/server";

export default async function Header() {
  const user = await getUser();
  const identity = user ? { label: user.user_metadata?.full_name || user.email || "Signed in" } : null;
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-line bg-background px-[6vw] py-[22px]">
      <Link href="/" className="shrink-0 font-display text-[22px] font-semibold no-underline" aria-label="Roll N Spice home">
        Roll N <span className="text-spice">Spice</span>
      </Link>
      <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-4 text-sm text-muted sm:gap-7">
        <a href="#menu">Menu</a>
        <a href="#about" className="hidden min-[401px]:inline">About</a>
        <CartButton />
        <AuthControls user={identity} />
      </nav>
    </header>
  );
}
