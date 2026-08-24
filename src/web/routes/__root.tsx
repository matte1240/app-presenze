import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "../ui/primitives";
import { t } from "../i18n/it";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  errorComponent: RootError,
  notFoundComponent: NotFound,
});

function RootError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-elevation-2">
        <AlertTriangle className="mx-auto mb-3 size-8 text-warning" aria-hidden />
        <h1 className="text-sm font-semibold">{t.app.genericError}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{error.message}</p>
        <Button className="mt-4" onClick={reset}>
          {t.app.retry}
        </Button>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="text-center">
        <p className="text-3xl font-semibold">404</p>
        <p className="mt-1 text-sm text-muted-foreground">Pagina inesistente.</p>
      </div>
    </div>
  );
}
