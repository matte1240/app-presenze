"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

type Toast = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss; 0 keeps it until dismissed. */
  duration?: number;
};

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/**
 * Minimal toast stack — no dependency, no portal library.
 *
 * It exists to retire `window.alert`, which blocks the main thread, cannot be
 * styled or branded, and reads as an unfinished prototype in a product being
 * demoed to a buyer.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    ({ title, description, variant = "info", duration = 5000 }: ToastInput) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, title, description, variant }]);

      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        // Announced politely: a toast reports the result of something the user
        // just did, it should not interrupt what they are reading now.
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const variantStyles: Record<ToastVariant, { accent: string; icon: typeof Info }> = {
  success: { accent: "text-success", icon: CheckCircle2 },
  error: { accent: "text-destructive", icon: AlertCircle },
  info: { accent: "text-info", icon: Info },
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const { accent, icon: Icon } = variantStyles[toast.variant];

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-2.5 rounded-md border border-border bg-popover p-3",
        "shadow-elevation-3 animate-in slide-in-from-bottom-2 fade-in duration-200"
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", accent)} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Chiudi notifica"
        className="-mr-0.5 -mt-0.5 shrink-0 cursor-pointer rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return push;
}
