import { getAuthSession } from "@/lib/auth";
import Navbar from "@/components/layout/navbar";
import ActivityTracker from "@/components/features/activity-tracker";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth enforced by proxy.ts — session is guaranteed non-null here
  const session = (await getAuthSession())!;

  return (
    <div className="min-h-screen bg-background">
      <ActivityTracker />
      <Navbar
        userRole={session.user.role}
        userName={session.user.name}
        userEmail={session.user.email}
        userImage={session.user.image}
      />
      <main>{children}</main>
    </div>
  );
}
