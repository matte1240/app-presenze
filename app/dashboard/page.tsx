import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { isAdmin } from "@/lib/utils/user-utils";

export default async function DashboardPage() {
  // Auth enforced by proxy.ts — session is guaranteed non-null here
  const session = (await getAuthSession())!;

  // Redirect based on user role
  if (isAdmin(session)) {
    redirect("/dashboard/admin");
  } else {
    redirect("/dashboard/calendar");
  }
}
