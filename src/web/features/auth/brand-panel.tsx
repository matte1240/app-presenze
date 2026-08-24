import { Clock3 } from "lucide-react";
import { t } from "../../i18n/it";
import { cn } from "../../ui/cn";

/**
 * A month of working days, drawn as the rhythm it is.
 *
 * The same columns the report chart draws and the same meter that sits under
 * every calendar day, turned down to a whisper — so the decoration is the
 * product's own vocabulary rather than ornament borrowed from somewhere else.
 * The pattern is fixed, not generated: five weeks with the weekends left as
 * gaps, a few short days and one long one. Random heights read as noise.
 */
const RHYTHM: ReadonlyArray<{ base: number; tip?: number }> = [
  { base: 0.86 }, { base: 0.9 }, { base: 1 }, { base: 0.82, tip: 0.12 }, { base: 0.94 }, { base: 0 }, { base: 0 },
  { base: 1 }, { base: 0.72, tip: 0.2 }, { base: 0.9 }, { base: 1 }, { base: 0.78 }, { base: 0 }, { base: 0 },
  { base: 0.92 }, { base: 1 }, { base: 0.58, tip: 0.3 }, { base: 0.88 }, { base: 1, tip: 0.22 }, { base: 0 }, { base: 0 },
  { base: 0.84 }, { base: 0.96 }, { base: 1 }, { base: 0.9 }, { base: 0.76, tip: 0.16 }, { base: 0 }, { base: 0 },
];

/**
 * The sign-in panel: three layers under the content.
 *
 * A tinted gradient for depth, one soft light source, and the dot grid on top
 * of both. The grid is what keeps it from looking like a plain wash — it reads
 * as engineered rather than decorated, and it costs one gradient.
 */
export function BrandPanel({ className, companyName }: { className?: string; companyName: string }) {
  return (
    <aside
      className={cn(
        "relative flex-col justify-center overflow-hidden border-r border-border p-10 xl:p-14",
        "bg-[linear-gradient(158deg,hsl(var(--panel-from)),hsl(var(--panel-to)))]",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 size-[34rem] rounded-full blur-3xl"
        style={{ backgroundColor: "hsl(var(--panel-glow) / 0.16)" }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-45"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, hsl(var(--muted-foreground) / 0.35) 1px, transparent 0)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse 90% 70% at 30% 20%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 30% 20%, black, transparent)",
        }}
      />

      {/* The mark and the credit are floated to the edges so the middle holds
          one thing: the sentence and the graphic that illustrates it. */}
      <div className="absolute inset-x-10 top-10 z-10 flex items-center gap-2 text-title font-semibold xl:inset-x-14 xl:top-14">
        <Clock3 className="size-6 text-primary" aria-hidden />
        {t.app.name}
      </div>

      <div className="relative z-10 max-w-lg">
        <h1 className="text-hero font-semibold tracking-[-0.03em] text-foreground">{t.auth.tagline}</h1>
        <Rhythm className="mt-12 h-24" />
      </div>

      <p className="absolute inset-x-10 bottom-10 z-10 text-label text-panel-ink-muted xl:inset-x-14 xl:bottom-14">
        © {new Date().getFullYear()} {companyName}
      </p>
    </aside>
  );
}

export function Rhythm({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex items-end gap-[3px]", className)}>
      {RHYTHM.map((day, index) => (
        <span key={index} className="flex h-full flex-1 flex-col justify-end">
          {day.base > 0 ? (
            <>
              {day.tip ? (
                <span
                  className="w-full rounded-t-[3px] bg-primary/55"
                  style={{ height: `${day.tip * 100}%` }}
                />
              ) : null}
              <span
                className={cn("w-full bg-primary/28", day.tip ? "mt-[2px]" : "rounded-t-[3px]")}
                style={{ height: `${day.base * 100}%` }}
              />
            </>
          ) : (
            // Weekends are the gaps. Leaving them empty is what makes the row
            // read as a month rather than as a bar chart of nothing.
            <span className="h-[2px] w-full rounded-full bg-primary/20" />
          )}
        </span>
      ))}
    </div>
  );
}
