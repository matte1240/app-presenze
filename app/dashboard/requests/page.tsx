import { getAuthSession } from "@/lib/auth";
import RequestsList from "@/components/dashboard/employee/requests-list";

export default async function RequestsPage() {
  // Auth enforced by proxy.ts — session is guaranteed non-null here
  const session = (await getAuthSession())!;

  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <RequestsList isAdmin={isAdmin} />
    </div>
  );
}
