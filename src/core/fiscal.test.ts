import { describe, expect, it } from "vitest";
import {
  isFiscalCode,
  isPecAddress,
  isSdiCode,
  isVatNumber,
  needsDeliveryAddress,
  needsTaxIdentifier,
  type BillingIdentity,
} from "./fiscal";

describe("partita IVA", () => {
  it("accetta numeri realmente validi", () => {
    // Well-known Italian VAT numbers, check digit and all.
    expect(isVatNumber("00743110157")).toBe(true); // Eni
    expect(isVatNumber("00488410010")).toBe(true); // Fiat
  });

  it("rifiuta una cifra sbagliata, che la sola lunghezza lascerebbe passare", () => {
    expect(isVatNumber("00743110158")).toBe(false);
    // A transposition — the failure the checksum exists to catch.
    expect(isVatNumber("00743110175")).toBe(false);
  });

  it("rifiuta tutto ciò che non sono undici cifre", () => {
    expect(isVatNumber("0074311015")).toBe(false);
    expect(isVatNumber("IT00743110157")).toBe(false);
    expect(isVatNumber("")).toBe(false);
  });
});

describe("codice fiscale", () => {
  it("accetta un codice personale con il carattere di controllo giusto", () => {
    expect(isFiscalCode("RSSMRA85T10A562S")).toBe(true);
    expect(isFiscalCode("rssmra85t10a562s")).toBe(true);
  });

  it("rifiuta un codice personale con il controllo sbagliato", () => {
    expect(isFiscalCode("RSSMRA85T10A562A")).toBe(false);
  });

  it("per una società accetta la partita IVA, e la verifica come tale", () => {
    expect(isFiscalCode("00743110157")).toBe(true);
    expect(isFiscalCode("00743110158")).toBe(false);
  });

  it("rifiuta lunghezze impossibili", () => {
    expect(isFiscalCode("RSSMRA85T10A562")).toBe(false);
    expect(isFiscalCode("")).toBe(false);
  });
});

describe("recapito", () => {
  it("accetta un codice SDI di sei o sette caratteri", () => {
    expect(isSdiCode("ABC1234")).toBe(true);
    expect(isSdiCode("UF1234")).toBe(true);
    expect(isSdiCode("0000000")).toBe(true);
    expect(isSdiCode("ABC12")).toBe(false);
    expect(isSdiCode("ABC12345")).toBe(false);
  });

  it("riconosce una PEC come un indirizzo", () => {
    expect(isPecAddress("azienda@pec.it")).toBe(true);
    expect(isPecAddress("non una pec")).toBe(false);
  });
});

describe("cosa manca per fatturare", () => {
  const identity = (over: Partial<BillingIdentity> = {}): BillingIdentity => ({
    country: "IT",
    vatNumber: "00743110157",
    taxCode: null,
    sdiCode: "ABC1234",
    pec: null,
    ...over,
  });

  it("un cliente italiano deve avere un recapito, SDI o PEC", () => {
    expect(needsDeliveryAddress(identity())).toBe(false);
    expect(needsDeliveryAddress(identity({ sdiCode: null, pec: "a@pec.it" }))).toBe(false);
    expect(needsDeliveryAddress(identity({ sdiCode: null, pec: null }))).toBe(true);
  });

  it("fuori dall'Italia il recapito non serve", () => {
    expect(needsDeliveryAddress(identity({ country: "DE", sdiCode: null, pec: null }))).toBe(false);
  });

  it("serve almeno un identificativo fiscale", () => {
    expect(needsTaxIdentifier(identity())).toBe(false);
    expect(needsTaxIdentifier(identity({ vatNumber: null, taxCode: "RSSMRA85T10A562S" }))).toBe(false);
    expect(needsTaxIdentifier(identity({ vatNumber: null, taxCode: null }))).toBe(true);
  });
});
