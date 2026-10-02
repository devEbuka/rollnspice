"use client";

import Link from "next/link";
import { useRef } from "react";

export default function MobileMenu({ signedIn }) {
  const menuRef = useRef(null);
  function close() { menuRef.current.open = false; }
  return <details ref={menuRef} className="mobile-menu">
    <summary aria-label="Navigation menu"><span aria-hidden="true">☰</span></summary>
    <div>
      <Link href="/#menu" onClick={close}>Menu</Link>
      <Link href="/#about" onClick={close}>About</Link>
      {signedIn && <Link href="/orders" onClick={close}>Orders</Link>}
    </div>
  </details>;
}
