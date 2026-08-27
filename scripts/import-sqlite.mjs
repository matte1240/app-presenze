/**
 * Brings the single-company SQLite database into the multi-tenant one.
 *
 *   node scripts/import-sqlite.mjs ./data/app.db "Nome Azienda" [--plan PRO] [--status ACTIVE]
 *
 * Everything that identifies a person is carried across unchanged, password
 * hashes included: an existing customer should find their accounts exactly as
 * they left them, not a note asking everyone to reset. The row ids are kept too,
 * so any link or export anybody has saved still resolves.
 *
 * Sessions and password-reset tokens are deliberately left behind. They are
 * credentials with a shelf life, and carrying a live session across a migration
 * would mean carrying it across an authentication model that has changed
 * underneath it.
 *
 * Runs as the table owner (DATABASE_ADMIN_URL), because it writes rows for an
 * organization it is in the middle of creating and so cannot be inside one yet.
 * It is idempotent by refusal, not by merge: if the slug already exists it
 * stops, rather than half-importing on top of a previous run.
 */
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

const [file, organizationName, ...rest] = process.argv.slice(2);

if (!file || !organizationName) {
  console.error(
    'Uso: node scripts/import-sqlite.mjs <app.db> "<Nome Azienda>" [--plan STARTER|PRO|BUSINESS] [--status TRIAL|ACTIVE]',
  );
  process.exit(1);
}

const flag = (name, fallback) => {
  const index = rest.indexOf(`--${name}`);
  return index >= 0 ? (rest[index + 1] ?? fallback) : fallback;
};

// An existing customer is not on a trial: they have been paying, one way or
// another, since before any of this existed.
const plan = flag("plan", "STARTER");
const status = flag("status", "ACTIVE");
const timezone = flag("timezone", process.env.TZ || "Europe/Rome");
const patronDays = flag("patron-days", process.env.DEFAULT_HOLIDAY_PATRON_DAYS ?? "");

const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Serve DATABASE_ADMIN_URL (o DATABASE_URL) per scrivere sul database di destinazione.");
  process.exit(1);
}

const slugify = (name) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "org";

/** SQLite kept timestamps as epoch milliseconds and booleans as 0/1. */
const at = (value) => (value === null || value === undefined ? null : new Date(Number(value)));
const bool = (value) => Boolean(value);

const source = new DatabaseSync(file, { readOnly: true });
const sql = postgres(url, { onnotice: () => {} });

const read = (table) => source.prepare(`SELECT * FROM ${table}`).all();

try {
  const users = read("users");
  if (users.length === 0) {
    console.error("Il database di origine non contiene utenti: niente da importare.");
    process.exit(1);
  }

  const slug = slugify(organizationName);
  const [clash] = await sql`SELECT id FROM organizations WHERE slug = ${slug}`;
  if (clash) {
    console.error(
      `Esiste già un'organizzazione con slug "${slug}". Rinominala, oppure elimina l'importazione precedente.`,
    );
    process.exit(1);
  }

  // The row ids are carried over, so a source database can only be imported
  // once. That is a feature — it is what stops a second run from silently
  // duplicating a customer under a new name — but the constraint violation on
  // its own would not explain itself.
  const ids = users.map((u) => u.id);
  const [alreadyHere] = await sql`
    SELECT u.id, o.name AS organization
    FROM users u JOIN organizations o ON o.id = u.organization_id
    WHERE u.id IN ${sql(ids)}
    LIMIT 1
  `;
  if (alreadyHere) {
    console.error(
      `Questo database è già stato importato in "${alreadyHere.organization}" ` +
        `(l'utente ${alreadyHere.id} esiste già). Elimina quell'organizzazione prima di riprovare.`,
    );
    process.exit(1);
  }

  const schedules = read("work_schedules");
  const entries = read("time_entries");
  const requests = read("leave_requests");

  const organizationId = randomUUID();

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO organizations
        (id, name, slug, status, plan, trial_ends_at, timezone, holiday_patron_days, company_name, created_at)
      VALUES
        (${organizationId}, ${organizationName}, ${slug}, ${status}, ${plan}, NULL,
         ${timezone}, ${patronDays}, ${organizationName}, now())
    `;

    for (const user of users) {
      await tx`
        INSERT INTO users
          (id, organization_id, name, email, password_hash, role,
           can_work_sunday, has_104, has_paternity, created_at, updated_at)
        VALUES
          (${user.id}, ${organizationId}, ${user.name}, ${String(user.email).toLowerCase()},
           ${user.password_hash}, ${user.role}, ${bool(user.can_work_sunday)}, ${bool(user.has_104)},
           ${bool(user.has_paternity)}, ${at(user.created_at)}, ${at(user.updated_at)})
      `;
    }

    for (const row of schedules) {
      await tx`
        INSERT INTO work_schedules
          (organization_id, user_id, weekday, is_working, morning_start, morning_end,
           afternoon_start, afternoon_end, contract_hours, manual_hours)
        VALUES
          (${organizationId}, ${row.user_id}, ${row.weekday}, ${bool(row.is_working)},
           ${row.morning_start}, ${row.morning_end}, ${row.afternoon_start}, ${row.afternoon_end},
           ${row.contract_hours}, ${bool(row.manual_hours)})
      `;
    }

    for (const row of entries) {
      await tx`
        INSERT INTO time_entries
          (id, organization_id, user_id, work_date, kind,
           morning_start, morning_end, afternoon_start, afternoon_end,
           morning_on_leave, afternoon_on_leave, use_104, hours_104_override,
           regular_hours, overtime_hours, leave_hours, leave_104_hours,
           vacation_hours, sickness_hours, paternity_hours,
           notes, medical_certificate, created_by, created_at, updated_at)
        VALUES
          (${row.id}, ${organizationId}, ${row.user_id}, ${row.work_date}, ${row.kind},
           ${row.morning_start}, ${row.morning_end}, ${row.afternoon_start}, ${row.afternoon_end},
           ${bool(row.morning_on_leave)}, ${bool(row.afternoon_on_leave)}, ${bool(row.use_104)},
           ${row.hours_104_override},
           ${row.regular_hours}, ${row.overtime_hours}, ${row.leave_hours}, ${row.leave_104_hours},
           ${row.vacation_hours}, ${row.sickness_hours}, ${row.paternity_hours},
           ${row.notes}, ${row.medical_certificate}, ${row.created_by},
           ${at(row.created_at)}, ${at(row.updated_at)})
      `;
    }

    for (const row of requests) {
      await tx`
        INSERT INTO leave_requests
          (id, organization_id, user_id, type, status, start_date, end_date,
           start_time, end_time, reason, reviewed_by, reviewed_at, created_at)
        VALUES
          (${row.id}, ${organizationId}, ${row.user_id}, ${row.type}, ${row.status},
           ${row.start_date}, ${row.end_date}, ${row.start_time}, ${row.end_time},
           ${row.reason}, ${row.reviewed_by}, ${at(row.reviewed_at)}, ${at(row.created_at)})
      `;
    }
  });

  console.info(`Importazione completata in "${organizationName}" (${slug}):`);
  console.info(`  utenti      ${users.length}`);
  console.info(`  orari       ${schedules.length}`);
  console.info(`  cartellini  ${entries.length}`);
  console.info(`  richieste   ${requests.length}`);
  console.info("\nLe password sono state mantenute: nessuno deve reimpostarla.");
  console.info("Le sessioni aperte no: chi era collegato dovrà rifare l'accesso.");
} finally {
  source.close();
  await sql.end({ timeout: 5 });
}
