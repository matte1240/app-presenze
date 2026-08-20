import { ManageServer } from "@/components/dashboard/admin/manage-server";
import { getBranding } from "@/lib/branding";

export async function generateMetadata() {
  return {
    title: `Gestione Server - ${getBranding().app.name}`,
    description: "Database backup and restore management",
  };
}

// Auth + admin role enforced by proxy.ts
export default async function ManageServerPage() {
  return <ManageServer />;
}
