import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import SetupForm from "@/components/auth/setup-form";
import { getBranding } from "@/lib/branding";
import { Logo } from "@/components/ui/logo";

// Force dynamic rendering to avoid build-time database access
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Check if any users already exist
  const userCount = await prisma.user.count();
  
  if (userCount > 0) {
    // Setup already completed, redirect to login
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-[22rem]">
        <div className="mb-8 flex justify-center">
          <Logo className="h-9 w-auto max-w-[190px]" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Benvenuto in {getBranding().app.name}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Crea il primo account amministratore per iniziare.
          </p>
        </div>
        <SetupForm />
      </div>
    </div>
  );
}
