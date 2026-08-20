import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/login-form";
import { getAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Logo } from "@/components/ui/logo";
import { getBranding } from "@/lib/branding";
import { CheckCircle2, AlertCircle, Clock, CalendarDays, Shield } from "lucide-react";

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

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-muted/30 p-12 flex-col justify-between relative overflow-hidden border-r border-border">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-40 dark:opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl -translate-y-1/4 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/20 rounded-full blur-3xl translate-y-1/4 -translate-x-1/4" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <Logo className="h-14 w-auto" />
          </div>
          <h1 className="text-5xl font-bold text-foreground leading-tight mb-6">
            {app.tagline}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
            {app.subtitle}
          </p>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="flex items-start gap-4 group">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:shadow-lg transition-all duration-300 border border-primary/20">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Gestione Ore</p>
              <p className="text-sm text-muted-foreground">Registra le ore lavorative giornaliere con turni mattutini e pomeridiani</p>
            </div>
          </div>
          <div className="flex items-start gap-4 group">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center group-hover:shadow-lg transition-all duration-300 border border-secondary/20">
              <CalendarDays className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Ferie e Permessi</p>
              <p className="text-sm text-muted-foreground">Richiedi ferie, permessi e gestisci le assenze in modo semplice</p>
            </div>
          </div>
          <div className="flex items-start gap-4 group">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center group-hover:shadow-lg transition-all duration-300 border border-accent/20">
              <Shield className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Pannello Amministratore</p>
              <p className="text-sm text-muted-foreground">Gestisci il team, approva richieste e consulta i report aziendali</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md relative z-10">
          <div className="bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
            <div className="p-8">
              <div className="flex justify-center mb-8 lg:hidden">
                <Logo className="h-12 w-auto" />
              </div>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">Bentornato</h2>
                <p className="text-sm text-muted-foreground">
                  Accedi al tuo account per continuare
                </p>
              </div>

              {showSetupSuccess && (
                <div className="mb-6 rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20 shadow-sm animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-sm text-emerald-800 dark:text-emerald-200 font-medium pt-1">
                      Configurazione completata con successo! Ora puoi accedere con il tuo account amministratore.
                    </p>
                  </div>
                </div>
              )}

              {showPasswordResetSuccess && (
                <div className="mb-6 rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20 shadow-sm animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-sm text-emerald-800 dark:text-emerald-200 font-medium pt-1">
                      Password aggiornata con successo! Ora puoi accedere.
                    </p>
                  </div>
                </div>
              )}

              {showExpiredMessage && (
                <div className="mb-6 rounded-xl bg-orange-500/10 p-4 border border-orange-500/20 shadow-sm animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <p className="text-sm text-orange-800 dark:text-orange-200 font-medium pt-1">
                      La sessione è scaduta per inattività. Effettua nuovamente il login.
                    </p>
                  </div>
                </div>
              )}

              <LoginForm />
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()}{" "}
            {company.website ? (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {company.name}
              </a>
            ) : (
              company.name
            )}
            . Tutti i diritti riservati.
          </p>
        </div>
      </div>
    </div>
  );
}
