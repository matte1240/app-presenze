import { getAuthSession } from "@/lib/auth";
import RequestsList from "@/components/dashboard/employee/requests-list";
import { PageContainer, PageHeader } from "@/components/layout/page";

export default async function RequestsPage() {
  // Auth enforced by proxy.ts — session is guaranteed non-null here
  const session = (await getAuthSession())!;

  const isAdmin = session.user.role === "ADMIN";

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Richieste"
        description={
          isAdmin
            ? "Approva o rifiuta le richieste di ferie e permessi del team."
            : "Le tue richieste di ferie e permessi."
        }
      />
      <RequestsList isAdmin={isAdmin} />
    </PageContainer>
  );
}
