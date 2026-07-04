import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

function hashPassword(password) {
  const salt = randomBytes(16).toString("base64");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAX_MEMORY
  });

  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt, derivedKey.toString("base64")].join("$");
}

const users = [
  {
    name: "Abarado",
    email: "owner@ysabellestore.local",
    password: "OwnerPass#2026",
    role: "OWNER"
  },
  {
    name: "Staff User",
    email: "staff@ysabellestore.local",
    password: "StaffPass#2026",
    role: "STAFF"
  }
];

async function main() {
  for (const user of users) {
    await prisma.user.upsert({
      where: {
        email: user.email
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash: hashPassword(user.password),
        role: user.role,
        status: "ACTIVE"
      },
      update: {
        name: user.name,
        passwordHash: hashPassword(user.password),
        role: user.role,
        status: "ACTIVE"
      }
    });
  }

  console.info("Development auth seed users are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
