"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type DialogSize = "sm" | "md" | "lg";

const sizeStyles: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Rendered right-aligned in the footer; omit for a body-only dialog. */
  footer?: ReactNode;
  size?: DialogSize;
  /** Hides the corner close button, for dialogs that demand an explicit choice. */
  hideClose?: boolean;
  className?: string;
}

/**
 * Modal shell shared by every dialog in the product.
 *
 * The behaviour that is easy to forget when a modal is hand-rolled — Escape to
 * dismiss, a scroll lock on the body, focus moved into the panel and returned
 * on close, a labelled dialog role — lives here once instead of being
 * approximated differently in each of the seven places that need it.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  hideClose = false,
  className,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      // Keep Tab inside the panel: focus escaping to the page behind a modal
      // is the classic way a dialog stops being modal for keyboard users.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the first control rather than the panel, so typing starts where
    // the user expects in a form dialog.
    const firstField = panelRef.current?.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), textarea, select'
    );
    (firstField ?? panelRef.current)?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px] animate-in fade-in duration-150"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? "dialog-description" : undefined}
        tabIndex={-1}
        className={cn(
          "scrollbar-slim relative flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden",
          "rounded-lg border border-border bg-card shadow-elevation-3 outline-none",
          "animate-in fade-in zoom-in-95 duration-150",
          sizeStyles[size],
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2
              id="dialog-title"
              className="text-sm font-semibold tracking-tight text-foreground"
            >
              {title}
            </h2>
            {description && (
              <p
                id="dialog-description"
                className="mt-1 text-[13px] leading-relaxed text-muted-foreground"
              >
                {description}
              </p>
            )}
          </div>
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi"
              className="-mr-1 -mt-1 shrink-0 cursor-pointer rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {children && (
          <div className="scrollbar-slim flex-1 overflow-y-auto px-5 py-4">
            {children}
          </div>
        )}

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Confirmation dialog for irreversible actions — the replacement for
 * `window.confirm`, which cannot be styled, cannot be branded, and gives no
 * room to say what is about to be lost.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
  destructive = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
