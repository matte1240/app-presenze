/**
 * Can you get there from here?
 *
 * Not a UI regression suite — the pages' contents are covered by the unit and
 * API tests. This checks the one property those cannot: that every screen a
 * customer or an operator is told about actually renders when navigated to.
 *
 * The back-office shipped once with its layout route missing an `<Outlet/>`,
 * so signing in returned you to the sign-in page. Every API test passed. These
 * three journeys are what would have caught it.
 */
import { expect, test, type Page } from "@playwright/test";

const PLATFORM = { email: "e2e@example.com", password: "E2ePassword1!" };

const unique = () => Math.random().toString(36).slice(2, 10);

/** Signs a fresh company up through the public form and lands in the app. */
async function signUp(page: Page) {
  const suffix = unique();
  const company = `Azienda ${suffix}`;
  const email = `admin-${suffix}@example.com`;

  await page.goto("/registrati");
  await page.getByLabel("Nome dell'organizzazione").fill(company);
  await page.getByLabel("Il tuo nome").fill("Admin E2E");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password1!");
  await page.getByRole("button", { name: "Inizia la prova gratuita" }).click();

  await expect(page).toHaveURL(/\/calendario$/);
  return { company, email };
}

test.describe("l'applicazione", () => {
  test("porta un'organizzazione appena registrata su ogni schermata del menu", async ({ page }) => {
    await signUp(page);

    /**
     * Every nav entry an administrator is shown, paired with a line that only
     * that page's body contains.
     *
     * The subtitle rather than the heading, deliberately: the shell's own
     * header repeats the nav label, so asserting on a heading would pass even
     * with an empty outlet — which is precisely the failure being guarded
     * against.
     */
    const screens: Array<[string, string]> = [
      ["Calendario", "Registra le ore giorno per giorno."],
      ["Richieste", "Approva o rifiuta le richieste del team."],
      ["Report", "Riepiloghi mensili ed esportazione per le paghe."],
      ["Utenti", "Account, ruoli e orari di lavoro."],
      ["Abbonamento", "Piano, utenti e fatturazione."],
      ["Manutenzione", "I tuoi dati, quando ti servono altrove."],
      ["Profilo", "I tuoi dati e la password."],
    ];

    for (const [link, ownWords] of screens) {
      await page.getByRole("link", { name: link, exact: true }).first().click();
      await expect(page.getByText(ownWords)).toBeVisible();
    }
  });
});

test.describe("il back-office", () => {
  test("dopo l'accesso mostra l'elenco delle organizzazioni, non di nuovo l'accesso", async ({ page }) => {
    await page.goto("/piattaforma");
    await page.getByLabel("Email").fill(PLATFORM.email);
    await page.getByLabel("Password").fill(PLATFORM.password);
    await page.getByRole("button", { name: "Accedi" }).click();

    await expect(page).toHaveURL(/\/piattaforma\/organizzazioni$/);
    // The precise regression: the sign-in form must be gone.
    await expect(page.getByRole("heading", { name: "Organizzazioni" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Accedi" })).toHaveCount(0);
  });

  test("entra in un'organizzazione e la marca come impersonata", async ({ page, context }) => {
    const { company } = await signUp(page);
    await context.clearCookies();

    await page.goto("/piattaforma");
    await page.getByLabel("Email").fill(PLATFORM.email);
    await page.getByLabel("Password").fill(PLATFORM.password);
    await page.getByRole("button", { name: "Accedi" }).click();
    await expect(page.getByRole("heading", { name: "Organizzazioni" })).toBeVisible();

    const row = page.getByRole("row").filter({ hasText: company });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Entra come amministratore" }).click();

    await expect(page).toHaveURL(/\/calendario$/);
    await expect(page.getByText(/dal back-office/)).toBeVisible();
  });
});
