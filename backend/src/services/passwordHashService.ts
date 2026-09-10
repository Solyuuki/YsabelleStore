import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const HASH_ALGORITHM = "scrypt";
const KEY_LENGTH = 64;

const SCRYPT_PROFILES = {
  legacy: { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
  current: { N: 65536, r: 8, p: 1, maxmem: 160 * 1024 * 1024 }
} as const;

type ScryptProfileName = keyof typeof SCRYPT_PROFILES;
type ScryptProfile = (typeof SCRYPT_PROFILES)[ScryptProfileName];

type ParsedPasswordHash = {
  profile: ScryptProfile;
  profileName: ScryptProfileName;
  salt: string;
  expected: Buffer;
};

function resolveSupportedProfile(N: number, r: number, p: number) {
  for (const [profileName, profile] of Object.entries(SCRYPT_PROFILES) as Array<
    [ScryptProfileName, ScryptProfile]
  >) {
    if (profile.N === N && profile.r === r && profile.p === p) {
      return { profileName, profile };
    }
  }

  return null;
}

function parsePasswordHash(passwordHash: string): ParsedPasswordHash | null {
  const [algorithm, nValue, rValue, pValue, salt, expectedHash, ...extra] = passwordHash.split("$");

  if (
    algorithm !== HASH_ALGORITHM ||
    !nValue ||
    !rValue ||
    !pValue ||
    !salt ||
    !expectedHash ||
    extra.length > 0
  ) {
    return null;
  }

  const N = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);
  if (!Number.isSafeInteger(N) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p)) {
    return null;
  }

  const resolved = resolveSupportedProfile(N, r, p);
  if (!resolved) return null;

  const expected = Buffer.from(expectedHash, "base64");
  if (expected.length !== KEY_LENGTH) return null;

  return {
    ...resolved,
    salt,
    expected
  };
}

function scrypt(
  password: string,
  salt: string,
  keyLength: number,
  profile: ScryptProfile
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      keyLength,
      {
        N: profile.N,
        r: profile.r,
        p: profile.p,
        maxmem: profile.maxmem
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

async function hashPasswordWithProfile(
  password: string,
  profileName: ScryptProfileName
): Promise<string> {
  const profile = SCRYPT_PROFILES[profileName];
  const salt = randomBytes(16).toString("base64");
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, profile);

  return [
    HASH_ALGORITHM,
    profile.N,
    profile.r,
    profile.p,
    salt,
    derivedKey.toString("base64")
  ].join("$");
}

export async function hashPassword(password: string): Promise<string> {
  return hashPasswordWithProfile(password, "current");
}

export async function hashPasswordWithProfileForTest(
  password: string,
  profileName: ScryptProfileName
): Promise<string> {
  return hashPasswordWithProfile(password, profileName);
}

export function passwordHashNeedsUpgrade(passwordHash: string): boolean {
  const parsed = parsePasswordHash(passwordHash);
  return parsed?.profileName !== "current";
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const parsed = parsePasswordHash(passwordHash);
  if (!parsed) return false;

  const actual = await scrypt(password, parsed.salt, parsed.expected.length, parsed.profile);

  return actual.length === parsed.expected.length && timingSafeEqual(actual, parsed.expected);
}
