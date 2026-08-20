"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      // signOut with redirect:false to handle navigation manually
      await signOut({ redirect: false });
    } catch {
      // Ignore errors — session is already cleared server-side
    }
    // Force hard navigation to clear all client state
    window.location.href = "/";
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Disconnessione...
        </>
      ) : (
        <>
          <LogOut className="mr-2 h-4 w-4" />
          Esci
        </>
      )}
    </button>
  );
}
