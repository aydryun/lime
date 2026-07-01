import { describe, expect, mock, test } from "bun:test";

// organisations.ts importe (transitivement) config.js, qui exige JWT_SECRET.
// On le mocke pour rendre ce test unitaire autonome (sans .env ni BDD).
mock.module("../../src/config.js", () => ({ JWT_SECRET: "test-secret" }));

const { validateOrgFields } = await import("../../src/organisations.ts");

/** Récupère les champs validés (échoue si la validation a renvoyé une erreur). */
function fieldsOf(result: ReturnType<typeof validateOrgFields>) {
  if ("error" in result) throw new Error(`inattendu: ${result.error}`);
  return result.fields;
}

describe("validateOrgFields()", () => {
  test("nettoie et conserve un nom valide", () => {
    expect(fieldsOf(validateOrgFields({ nom: "  Acme  " })).nom).toBe("Acme");
  });

  test("ignore les clés inconnues", () => {
    const fields = fieldsOf(validateOrgFields({ inconnu: "x", nom: "Acme" }));
    expect(fields).not.toHaveProperty("inconnu");
    expect(fields.nom).toBe("Acme");
  });

  test("le nom vide est refusé", () => {
    const result = validateOrgFields({ nom: "" });
    expect("error" in result).toBe(true);
  });

  test("un autre champ vidé (null) est effacé", () => {
    expect(fieldsOf(validateOrgFields({ telephone: null })).telephone).toBeNull();
  });

  test("SIREN à 9 chiffres accepté", () => {
    expect(fieldsOf(validateOrgFields({ siren: "123456789" })).siren).toBe(
      "123456789",
    );
  });

  test("SIREN non conforme refusé", () => {
    expect("error" in validateOrgFields({ siren: "123" })).toBe(true);
    expect("error" in validateOrgFields({ siren: "12345678a" })).toBe(true);
  });

  test("SIRET à 14 chiffres accepté, sinon refusé", () => {
    expect(fieldsOf(validateOrgFields({ siret: "12345678901234" })).siret).toBe(
      "12345678901234",
    );
    expect("error" in validateOrgFields({ siret: "123" })).toBe(true);
  });

  test("email de contact validé", () => {
    expect(fieldsOf(validateOrgFields({ email: "contact@acme.fr" })).email).toBe(
      "contact@acme.fr",
    );
    expect("error" in validateOrgFields({ email: "pas-un-email" })).toBe(true);
  });

  test("valeur trop longue refusée", () => {
    expect("error" in validateOrgFields({ nom: "x".repeat(256) })).toBe(true);
  });

  test("valeur non-string (hors null) refusée", () => {
    expect("error" in validateOrgFields({ ville: 42 })).toBe(true);
  });
});
