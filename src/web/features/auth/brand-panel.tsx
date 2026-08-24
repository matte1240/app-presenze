import { CalendarDays, Clock, Clock3, Shield } from "lucide-react";
import { t } from "../../i18n/it";
import { cn } from "../../ui/cn";

const FEATURES = [
  { icon: Clock, ...t.auth.features.hours },
  { icon: CalendarDays, ...t.auth.features.leave },
  { icon: Shield, ...t.auth.features.admin },
] as const;

/**
 * The sign-in panel.
 *
 * Deliberately the recessed surface rather than a block of brand colour: the
 * split then has a reason to exist in both themes, and the headline can be set
 * in the ordinary text colour instead of white-on-accent. The texture is a
 * faint dot grid under a radial mask — it reads as engineered rather than
 * decorated, and it costs one gradient.
 */
export function BrandPanel({ className, companyName }: { className?: string; companyName: string }) {
  return (
    <aside
      className={cn(
        "relative flex-col justify-between overflow-hidden border-r border-border bg-surface-sunken/50 p-10 xl:p-14",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, hsl(var(--muted-foreground) / 0.35) 1px, transparent 0)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse 90% 70% at 30% 20%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 30% 20%, black, transparent)",
        }}
      />

      <div className="relative z-10 flex items-center gap-2 text-title font-semibold">
        <Clock3 className="size-6 text-primary" aria-hidden />
        {t.app.name}
      </div>

      <div className="relative z-10 max-w-lg">
        <h1 className="text-hero font-semibold tracking-[-0.03em] text-foreground">{t.auth.tagline}</h1>
        <p className="mt-5 text-title leading-relaxed text-muted-foreground">{t.auth.taglineHint}</p>

        <ul className="mt-10 space-y-5">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground">
                <Icon className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-body font-medium text-foreground">{title}</p>
                <p className="mt-0.5 text-body leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative z-10 text-label text-muted-foreground">
        © {new Date().getFullYear()} {companyName}
      </p>
    </aside>
  );
}
