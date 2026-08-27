import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText } from "lucide-react";
import { invoicesQuery } from "../../api/billing";
import { t } from "../../i18n/it";
import {
  Card,
  CardHeader,
  EmptyState,
  Table,
  TableWrapper,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "../../ui/primitives";

/**
 * The invoices Stripe has issued, where somebody would look for them, rather
 * than only behind a redirect into the billing portal.
 */
export function InvoiceList() {
  const { data, isLoading } = useQuery(invoicesQuery);
  if (isLoading) return null;

  return (
    <Card>
      <CardHeader title={t.billing.invoices} />
      {(data ?? []).length === 0 ? (
        <EmptyState icon={FileText} title={t.billing.noInvoices} />
      ) : (
        <TableWrapper className="rounded-none border-0">
          <Table>
            <THead>
              <TR>
                <TH>{t.billing.invoiceNumber}</TH>
                <TH>{t.platform.when}</TH>
                <TH numeric>{t.billing.amount}</TH>
                <TH className="text-right">{t.platform.actions}</TH>
              </TR>
            </THead>
            <TBody>
              {(data ?? []).map((invoice) => (
                <TR key={invoice.id}>
                  <TD className="font-mono text-[12px]">{invoice.number ?? "—"}</TD>
                  <TD>{new Date(invoice.createdAt).toLocaleDateString("it-IT")}</TD>
                  <TD numeric>
                    {invoice.total.toLocaleString("it-IT", {
                      style: "currency",
                      currency: invoice.currency,
                    })}
                  </TD>
                  <TD className="text-right">
                    {invoice.pdfUrl ?? invoice.hostedUrl ? (
                      <a
                        className="inline-flex items-center gap-1.5 text-label text-primary hover:underline"
                        href={invoice.pdfUrl ?? invoice.hostedUrl ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="size-3.5" aria-hidden />
                        {t.billing.openInvoice}
                      </a>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrapper>
      )}
    </Card>
  );
}
