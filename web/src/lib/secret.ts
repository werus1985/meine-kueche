import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * Verschlüsselung für gespeicherte Geheimnisse (z. B. Gemini-API-Keys).
 *
 * AES-256-GCM mit einem Schlüssel aus `AI_KEYS_SECRET` (Base64, 32 Byte).
 * Format: `v1.<iv>.<tag>.<cipher>` – alles Base64url. Werte ohne Präfix
 * gelten als Altbestand im Klartext und werden beim nächsten Speichern
 * verschlüsselt.
 */

const PREFIX = "v1.";
const IV_BYTES = 12;

function secretKey(): Buffer | null {
  const raw = process.env.AI_KEYS_SECRET?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

export function isAiKeysSecretConfigured() {
  return secretKey() !== null;
}

export function isEncryptedSecret(value: string) {
  return value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string | null {
  const key = secretKey();
  if (!key) return null;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX.slice(0, -1),
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

/**
 * Entschlüsselt einen gespeicherten Wert. Klartext-Altbestand wird
 * unverändert zurückgegeben. `null` bedeutet: nicht lesbar (falscher oder
 * fehlender Schlüssel).
 */
export function decryptSecret(value: string): string | null {
  if (!isEncryptedSecret(value)) return value;

  const key = secretKey();
  if (!key) return null;

  const [, ivPart, tagPart, cipherPart] = value.split(".");
  if (!ivPart || !tagPart || !cipherPart) return null;

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(cipherPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
