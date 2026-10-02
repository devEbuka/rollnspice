"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

export default function AccountDropdown({ user, busy, onSignOut }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelId = useId();
  const words = user.label.trim().split(/\s+/);
  const initials = words.slice(0, 2).map((word) => Array.from(word)[0]).join("").toUpperCase();

  useEffect(() => {
    if (!open) return;
    function outside(event) {
      if (!rootRef.current.contains(event.target)) setOpen(false);
    }
    function escape(event) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <div ref={rootRef} className="account-dropdown" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={triggerRef} type="button" className="account-trigger" aria-label={`Account for ${user.label}`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
      <span className="account-initials" aria-hidden="true">{initials || "U"}</span>
      <span className="account-first-name" aria-hidden="true">{words[0]}</span>
      <span aria-hidden="true" className="account-chevron">⌄</span>
    </button>
    {open && <div id={panelId} className="account-panel">
      <p className="font-semibold break-words">{user.label}</p>
      {user.email && <p className="mt-1 break-all text-xs text-muted">{user.email}</p>}
      <div className="mt-4 border-t border-line pt-2">
        <Link href="/orders" onClick={() => setOpen(false)} className="account-action">Your orders</Link>
        <button type="button" onClick={onSignOut} disabled={busy} className="account-action">{busy ? "Signing out…" : "Sign out"}</button>
      </div>
    </div>}
  </div>;
}
