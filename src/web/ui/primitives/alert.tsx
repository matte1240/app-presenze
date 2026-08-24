import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../cn";

type Tone = "info" | "success" | "warning" | "danger";

const STYLES: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: "bg-info-subtle text-info", Icon: Info },
  success: { box: "bg-success-subtle text-success", Icon: CheckCircle2 },
  warning: { box: "bg-warning-subtle text-warning", Icon: AlertTriangle },
  danger: { box: "bg-destructive-subtle text-destructive", Icon: XCircle },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { box, Icon } = STYLES[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-2.5 rounded-sm px-3 py-2.5 text-label", box, className)}>
      <Icon className="mt-px size-3.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5")}>{children}</div> : null}
      </div>
    </div>
  );
}
