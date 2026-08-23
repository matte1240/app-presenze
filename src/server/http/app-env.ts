import type { ActiveSession } from "../auth/session";

export interface AppEnv {
  Variables: {
    /** Present on every route behind `loadSession`; guards narrow it further. */
    session: ActiveSession | null;
  };
}
