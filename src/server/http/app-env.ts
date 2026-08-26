import type { PlatformAdminRow } from "../db/platform-schema";
import type { ActiveSession } from "../auth/session";

export interface AppEnv {
  Variables: {
    /** Present on every route behind `loadSession`; guards narrow it further. */
    session: ActiveSession | null;
    /**
     * Only ever set under `/api/platform`. Kept apart from `session` so that
     * no ordinary handler can mistake one for the other: a tenant guard that
     * accepted a platform administrator would be a way into every customer.
     */
    platformAdmin: PlatformAdminRow | null;
  };
}
