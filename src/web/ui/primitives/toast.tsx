import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "../cn";

type Tone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: Tone;
  message: string;
}

const ICONS: Record<Tone, typeof Info> = { success: CheckCircle2, error: XCircle, info: Info };
const TONES: Record<Tone, string> = {
  success: "text-success",
  error: "text-destructive",
  info: "text-info",
};

const ToastContext = createContext<((tone: Tone, message: string) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((tone: Tone, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone, message }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed bottom-3 right-3 z-[60] flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-1.5"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone];
          return (
            <div
              key={toast.id}
              // One surface for every tone; only the icon carries the status,
              // which keeps a success message from shouting.
              className="pointer-events-auto flex items-start gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-label shadow-dialog"
            >
              <Icon className={cn("mt-px size-3.5 shrink-0", TONES[toast.tone])} aria-hidden />
              <span className="min-w-0 flex-1">{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast va usato dentro <ToastProvider>");
  return useMemo(
    () => ({
      success: (message: string) => push("success", message),
      error: (message: string) => push("error", message),
      info: (message: string) => push("info", message),
    }),
    [push],
  );
}
