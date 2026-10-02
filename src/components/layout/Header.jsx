import Link from "next/link";
import AuthControls from "./AuthControls";
import Brand from "./Brand";
import MobileMenu from "./MobileMenu";
import CartButton from "./CartButton";
import { getUser } from "@/lib/supabase/server";

export default async function Header() {
  const user = await getUser();
  const identity = user ? { label: user.user_metadata?.full_name || user.email || "Signed in", email: user.email } : null;
  return (
    <header className="site-header">
      <Brand />
      <nav aria-label="Main navigation" className="header-nav">
        <Link href="/#menu">Menu</Link>
        <Link href="/#about">About</Link>
        {user && <Link href="/orders">Orders</Link>}
        <MobileMenu signedIn={Boolean(user)} />
        <div className="desktop-cart"><CartButton /></div>
        <AuthControls user={identity} />
      </nav>
    </header>
  );
}
