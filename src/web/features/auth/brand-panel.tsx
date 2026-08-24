import { Clock3 } from "lucide-react";
import { t } from "../../i18n/it";
import { cn } from "../../ui/cn";

/**
 * A month of working days, drawn as the rhythm it is.
 *
 * The decoration on a sign-in screen is usually a stock illustration or a flat
 * block of brand colour. This is neither: it is the product's own vocabulary —
 * the same columns the report chart draws and the same meter that sits under
 * every calendar day — turned down to a whisper. It says "hours across days"
 * before a word is read, and it cannot go out of date with the product because
 * it is made of the product.
 *
 * The pattern is fixed, not generated: five weeks of full days with the
 * weekends left as gaps, a couple of short days and one long one. Random
 * heights would read as noise.
 */
const RHYTHM: ReadonlyArray<{ base: number; tip?: number }> = [
  { base: 0.86 }, { base: 0.9 }, { base: 1 }, { base: 0.82, tip: 0.12 }, { base: 0.94 }, { base: 0 }, { base: 0 },
  { base: 1 }, { base: 0.72, tip: 0.2 }, { base: 0.9 }, { base: 1 }, { base: 0.78 }, { base: 0 }, { base: 0 },
  { base: 0.92 }, { base: 1 }, { base: 0.58, tip: 0.3 }, { base: 0.88 }, { base: 1, tip: 0.22 }, { base: 0 }, { base: 0 },
  { base: 0.84 }, { base: 0.96 }, { base: 1 }, { base: 0.9 }, { base: 0.76, tip: 0.16 }, { base: 0 }, { base: 0 },
];

export function BrandPanel({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "relative isolate flex flex-col justify-center overflow-hidden p-10 text-white",
        "bg-[linear-gradient(152deg,hsl(var(--panel-from)),hsl(var(--panel-to)))]",
        className,
      )}
    >
      {/* A single soft highlight, so the surface reads as lit rather than filled. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 -z-10 size-[28rem] rounded-full bg-white/12 blur-3xl"
      />

      <div className="absolute inset-x-10 top-10 flex items-center gap-2 text-label font-semibold">
        <Clock3 className="size-5" aria-hidden />
        {t.app.name}
      </div>

      {/*
        One centred block, with the mark floated out to the corner.

        Spreading the three pieces across the full height with
        `justify-between` left a third of the panel as dead air, and pinning
        them to the floor only moved that hole to the top. Centred, the message
        also lands at the same height as the form on the other side, so the two
        halves read as one composition rather than two columns.
      */}
      <div>
        <div className="max-w-sm">
          <p className="text-2xl font-semibold leading-snug tracking-[-0.02em]">{t.auth.tagline}</p>
          <p className="mt-3 text-body text-white/75">{t.auth.taglineHint}</p>
        </div>
          <Rhythm className="mt-10 h-20" />
      </div>
    </aside>
  );
}

/**
 * `onBrand` draws in white over the panel; the plain tone draws in the accent,
 * for the phone layout where the panel is not shown at all.
 */
export function Rhythm({ className, onBrand = true }: { className?: string; onBrand?: boolean }) {
  const tip = onBrand ? "bg-white/55" : "bg-primary/45";
  const base = onBrand ? "bg-white/22" : "bg-primary/18";
  const gap = onBrand ? "bg-white/12" : "bg-primary/12";

  return (
    <div aria-hidden className={cn("flex items-end gap-[3px]", className)}>
      {RHYTHM.map((day, index) => (
        <span key={index} className="flex h-full flex-1 flex-col justify-end">
          {day.base > 0 ? (
            <>
              {day.tip ? (
                <span className={cn("w-full rounded-t-[3px]", tip)} style={{ height: `${day.tip * 100}%` }} />
              ) : null}
              <span
                className={cn("w-full", base, day.tip ? "mt-[2px]" : "rounded-t-[3px]")}
                style={{ height: `${day.base * 100}%` }}
              />
            </>
          ) : (
            // Weekends are the gaps. Leaving them empty is what makes the row
            // read as a month rather than as a bar chart of nothing.
            <span className={cn("h-[2px] w-full rounded-full", gap)} />
          )}
        </span>
      ))}
    </div>
  );
}
