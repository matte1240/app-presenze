import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/login-form";
import { getAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Logo } from "@/components/ui/logo";
import { getBranding } from "@/lib/branding";
import { Clock, CalendarDays, Shield } from "lucide-react";
import { Alert } from "@/components/ui/alert";

// Force dynamic rendering to check database at runtime
export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string; expired?: string; passwordReset?: string }>;
}) {
  // Check if setup is needed (no users in database)
  const userCount = await prisma.user.count();
  
  if (userCount === 0) {
    redirect("/setup");
  }

  const session = await getAuthSession();

  if (session) {
    // All users go to /dashboard, which handles role-based display
    redirect("/dashboard");
  }

  const { app, company } = getBranding();
  const params = await searchParams;
  const showSetupSuccess = params.setup === "complete";
  const showExpiredMessage = params.expired === "true";
  const showPasswordResetSuccess = params.passwordReset === "true";

  const features = [
    {
      icon: Clock,
      title: "Gestione ore",
      body: "Registra le ore giornaliere con turni mattutini e pomeridiani.",
    },
    {
      icon: CalendarDays,
      title: "Ferie e permessi",
      body: "Richiedi assenze e falle approvare senza passare dalla mail.",
    },
    {
      icon: Shield,
      title: "Pannello amministratore",
      body: "Gestisci il team, approva richieste e consulta i report.",
    },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* ------------------------------------------------------------------ */}
      {/* Brand panel                                                         */}
      {/* ------------------------------------------------------------------ */}
      {/* The brand side is the recessed surface and the form side the clean
          one, which gives the split a reason to exist in both themes — as
          `bg-card` it was all but identical to the background in light mode. */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-muted/40 p-10 lg:flex lg:w-[46%] xl:p-14">
        {/*
          A faint dot grid instead of the blurred colour blobs that used to sit
          here: it reads as engineered rather than decorative, and it costs one
          gradient instead of two 24rem blur layers.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, hsl(var(--muted-foreground) / 0.35) 1px, transparent 0)",
            backgroundSize: "22px 22px",
            maskImage:
              "radial-gradient(ellipse 90% 70% at 30% 20%, black, transparent)",
            WebkitMaskImage:
              "radial-gradient(ellipse 90% 70% at 30% 20%, black, transparent)",
          }}
        />

        <div className="relative z-10">
          <Logo className="h-9 w-auto max-w-[190px]" />
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-[2.75rem] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground">
            {app.tagline}
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
            {app.subtitle}
          </p>

          <div className="mt-10 space-y-5">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-[13px] font-medium text-foreground">{title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()}{" "}
          {company.website ? (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              {company.name}
            </a>
          ) : (
            company.name
          )}
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sign-in panel                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[22rem]">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo className="h-9 w-auto max-w-[190px]" />
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Bentornato
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Accedi al tuo account per continuare.
            </p>
          </div>

          <div className="space-y-4">
            {showSetupSuccess && (
              <Alert variant="success">
                Configurazione completata. Ora puoi accedere con il tuo account
                amministratore.
              </Alert>
            )}

            {showPasswordResetSuccess && (
              <Alert variant="success">
                Password aggiornata. Ora puoi accedere.
              </Alert>
            )}

            {showExpiredMessage && (
              <Alert variant="warning">
                La sessione è scaduta per inattività. Effettua nuovamente il login.
              </Alert>
            )}

            <LoginForm />
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground lg:hidden">
            © {new Date().getFullYear()} {company.name}
          </p>
        </div>
      </div>
    </div>
  );
}
