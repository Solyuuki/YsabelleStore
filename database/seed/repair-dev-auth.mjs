import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  throw new Error("Development auth repair cannot run when NODE_ENV=production.");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for development auth repair.");
}

const prisma = new PrismaClient();

const developmentUsers = [
  {
    name: "Abarado",
    email: "owner@ysabellestore.local",
    role: "OWNER",
    passwordHash:
      "scrypt$16384$8$1$a75538b5ebda853d10a2ef7c9355e89f$JsXlx4wKFTLTN/Sh3WSNXpObDk8dVzBg8DZbFz2GdnaLzvZavH3i3MChYR4n7JEgYo+DpTvc6lFRuPt/eVY9cA=="
  },
  {
    name: "Staff User",
    email: "staff@ysabellestore.local",
    role: "STAFF",
    passwordHash:
      "scrypt$16384$8$1$8970dc8a993743af2ee5ff7e45b175fe$JggkCQlru7gTzu+oG9pzJlh0E3hL+2M6oFJPm3aJBz7TJjl1RaYPhSJGstXxLbT681KLCGxyYJiYzfbLZZX7lw=="
  }
];

function describeDatabaseTarget(databaseUrl) {
  const parsed = new URL(databaseUrl);
  return `${parsed.hostname}:${parsed.port || "default"}/${parsed.pathname.replace(/^\//, "") || "(not specified)"}`;
}

try {
  for (const user of developmentUsers) {
    const repaired = await prisma.user.upsert({
      where: { email: user.email },
      create: {
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
        status: "ACTIVE"
      },
      update: {
        name: user.name,
        passwordHash: user.passwordHash,
        role: user.role,
        status: "ACTIVE"
      }
    });

    const verified = await prisma.user.findUnique({ where: { email: user.email } });
    if (!verified || verified.passwordHash !== user.passwordHash || verified.status !== "ACTIVE") {
      throw new Error(`Development auth repair verification failed for ${user.email}.`);
    }

    console.info(`Verified ${repaired.role} account: ${repaired.email}`);
  }

  console.info(`Development auth DB: ${describeDatabaseTarget(process.env.DATABASE_URL)}`);
  console.info("Development owner/staff authentication records are repaired and verified.");
} finally {
  await prisma.$disconnect();
}
