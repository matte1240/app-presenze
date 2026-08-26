/**
 * Italian invoicing identifiers, checked properly.
 *
 * A VAT number is not eleven digits; it is ten digits and a check character
 * computed from them. Validating only the length lets a transposed pair
 * through, and a transposed pair means an invoice that the exchange system
 * rejects weeks later, when the customer is already annoyed. The same goes for
 * the fiscal code, whose last letter is a checksum over the other fifteen.
 *
 * Pure and dependency-free, like everything else in `core/`.
 */

// ── Partita IVA ───────────────────────────────────────────────────────────

/**
 * Eleven digits, the last one a Luhn-style check over the first ten: digits in
 * even positions are doubled and folded back under ten, everything is summed,
 * and the check digit is what brings the total to a multiple of ten.
 */
export function isVatNumber(value: string): boolean {
  const digits = value.trim();
  if (!/^\d{11}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    const digit = Number(digits[i]);
    if (i % 2 === 0) {
      sum += digit;
    } else {
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    }
  }

  return (10 - (sum % 10)) % 10 === Number(digits[10]);
}

// ── Codice fiscale ────────────────────────────────────────────────────────

const ODD: Readonly<Record<string, number>> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

const EVEN: Readonly<Record<string, number>> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9, K: 10, L: 11, M: 12,
  N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19, U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
};

const CHECK_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Sixteen characters for a person, whose last letter is a checksum over the
 * other fifteen; eleven digits for a company, where it is the VAT number
 * again and is checked as one.
 */
export function isFiscalCode(value: string): boolean {
  const code = value.trim().toUpperCase();

  if (/^\d{11}$/.test(code)) return isVatNumber(code);
  if (!/^[A-Z0-9]{16}$/.test(code)) return false;

  let sum = 0;
  for (let i = 0; i < 15; i += 1) {
    const char = code[i]!;
    // Positions are one-based in the specification, so the first character is
    // odd and takes the odd table.
    const table = i % 2 === 0 ? ODD : EVEN;
    const weight = table[char];
    if (weight === undefined) return false;
    sum += weight;
  }

  return CHECK_CHARS[sum % 26] === code[15];
}

// ── Recapito per la fattura elettronica ───────────────────────────────────

/**
 * Seven characters for a private recipient, six for a public body. Either way
 * this is where the exchange system delivers the invoice.
 */
export const isSdiCode = (value: string): boolean => /^[A-Z0-9]{6,7}$/.test(value.trim().toUpperCase());

/** Deliberately loose: a PEC is an ordinary address on a certified domain. */
export const isPecAddress = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

export interface BillingIdentity {
  readonly country: string;
  readonly vatNumber: string | null;
  readonly taxCode: string | null;
  readonly sdiCode: string | null;
  readonly pec: string | null;
}

/**
 * An Italian invoice has to reach somewhere. Without a recipient code or a
 * certified address the exchange system has nowhere to deliver it, so the
 * invoice is issued and then simply never arrives — which is worse than being
 * refused up front.
 */
export function needsDeliveryAddress(identity: BillingIdentity): boolean {
  return identity.country.toUpperCase() === "IT" && !identity.sdiCode && !identity.pec;
}

/** At least one identifier: without either, there is nobody to invoice. */
export function needsTaxIdentifier(identity: BillingIdentity): boolean {
  return !identity.vatNumber && !identity.taxCode;
}
