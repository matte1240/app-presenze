/**
 * The current organization's settings, in the shape the domain wants them.
 *
 * Public holidays and the working timezone used to be two deploy-wide
 * environment variables, which is exactly as far as they could go when the
 * deployment was the company. They are columns on `organizations` now, and
 * these read them off the tenant context so that call sites keep passing
 * `holidays` and nothing else has to learn where it came from.
 */
import { holidayConfigOf } from "../env";
import { currentOrg } from "./context";

export function currentHolidays() {
  return holidayConfigOf(currentOrg().holidayPatronDays);
}

export function currentTimezone(): string {
  return currentOrg().timezone;
}
