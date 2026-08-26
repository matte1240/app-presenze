import { Link } from "@tanstack/react-router";
import type { CurrentOrganization } from "../../api/session";
import { t } from "../../i18n/it";
import { Alert, Button } from "../../ui/primitives";

/**
 * One line at the top of every screen when the subscription needs attention,
 * and nothing at all when it does not.
 *
 * The trial warning only appears in its last stretch: a banner that is always
 * there is a banner nobody reads, and the point of this one is that the day the
 * account turns read-only is not a surprise.
 */
const WARN_FROM_DAYS = 5;

function noticeFor(
  organization: CurrentOrganization,
): { tone: "warning" | "danger"; message: string } | null {
  if (organization.access === "read-only") {
    return { tone: "danger", message: t.billing.readOnlyBanner };
  }
  if (organization.status === "PAST_DUE") {
    return { tone: "warning", message: t.billing.pastDueBanner };
  }
  if (
    organization.status === "TRIAL" &&
    organization.trialDaysLeft !== null &&
    organization.trialDaysLeft <= WARN_FROM_DAYS
  ) {
    return { tone: "warning", message: t.billing.trialBanner(organization.trialDaysLeft) };
  }
  return null;
}

export function SubscriptionBanner({
  organization,
  isAdmin,
}: {
  organization: CurrentOrganization;
  isAdmin: boolean;
}) {
  const notice = noticeFor(organization);
  if (!notice) return null;

  return (
    <Alert tone={notice.tone} className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <span>{notice.message}</span>
      {isAdmin ? (
        <Button asChild size="sm" variant={notice.tone === "danger" ? "primary" : "outline"}>
          <Link to="/abbonamento">{t.billing.manage}</Link>
        </Button>
      ) : null}
    </Alert>
  );
}
