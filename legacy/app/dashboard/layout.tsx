import { getAuthSession } from "@/lib/auth";
import AppShell from "@/components/layout/app-shell";
import ActivityTracker from "@/components/features/activity-tracker";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth enforced by proxy.ts — session is guaranteed non-null here
  const session = (await getAuthSession())!;

  return (
    <>
      <ActivityTracker />
      <AppShell
        userRole={session.user.role}
        userName={session.user.name}
        userEmail={session.user.email}
      >
        {children}
      </AppShell>
    </>
  );
}
