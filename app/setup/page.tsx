import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import SetupForm from "@/components/auth/setup-form";
import { getBranding } from "@/lib/branding";

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
            Benvenuto in {getBranding().app.name}
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Let&apos;s set up your first administrator account to get started.
          </p>
        </div>
        <SetupForm />
      </div>
    </div>
  );
}
