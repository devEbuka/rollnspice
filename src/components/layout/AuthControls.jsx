"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeReturnPath } from "@/lib/auth/return-path";

export default function AuthControls({ user, returnTo }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") router.refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  async function handleAuth() {
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      if (user) {
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) throw error;
        router.refresh();
        setBusy(false);
      } else {
        const next = safeReturnPath(returnTo ?? (window.location.pathname + window.location.search + window.location.hash));
        const callback = new URL("/auth/callback", window.location.origin);
        callback.searchParams.set("next", next);
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: callback.toString() },
        });
        if (error) throw error;
      }
    } catch {
      setError(user ? "Could not sign out. Please try again." : "Could not sign in. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {user && <span className="max-w-40 truncate" title={user.label}>{user.label}</span>}
      <button type="button" onClick={handleAuth} disabled={busy} className="rounded-[3px] border border-line px-3 py-2 font-semibold text-ink disabled:opacity-60">
        {busy ? "Please wait…" : user ? "Sign out" : "Sign in with Google"}
      </button>
      {error && <p role="alert" className="w-full text-sm text-spice">{error}</p>}
    </div>
  );
}
