import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const HASH_ALGORITHM = "scrypt";
const KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

function scrypt(password: string, salt: string, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      keyLength,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAX_MEMORY
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      }
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64");
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);

  return [HASH_ALGORITHM, SCRYPT_N, SCRYPT_R, SCRYPT_P, salt, derivedKey.toString("base64")].join(
    "$"
  );
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [algorithm, nValue, rValue, pValue, salt, expectedHash] = passwordHash.split("$");

  if (algorithm !== HASH_ALGORITHM || !nValue || !rValue || !pValue || !salt || !expectedHash) {
    return false;
  }

  const expected = Buffer.from(expectedHash, "base64");
  const actual = await scrypt(password, salt, expected.length);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
