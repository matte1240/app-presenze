"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="flex max-w-sm flex-col items-center text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-destructive-subtle text-destructive">
          <AlertTriangle className="size-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
          Si è verificato un errore
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Qualcosa è andato storto nel caricamento della pagina. Riprova, oppure
          torna alla dashboard.
        </p>
        {/* The digest is the only handle support has on a production stack
            trace, so it is shown rather than swallowed. */}
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground/70">
            {error.digest}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <Button onClick={() => reset()}>Riprova</Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/dashboard")}
          >
            Torna alla dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
