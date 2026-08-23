"use client";

import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex max-w-sm flex-col items-center text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <WifiOff className="size-5" />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
          Sei offline
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Controlla la connessione e riprova. Le pagine già visitate restano
          disponibili.
        </p>
        <Button className="mt-5" onClick={() => window.location.reload()}>
          Riprova
        </Button>
      </div>
    </div>
  );
}
