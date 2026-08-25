import { createHash, randomBytes } from "node:crypto";

import jwt from "jsonwebtoken";
import type { User, UserRole } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import type {
  LoginRequestBody,
  RegisterRequestBody,
  TrustedDeviceRequestBody
} from "../validators/auth.validators.js";
import { hashPassword, verifyPassword } from "./passwordHashService.js";

const TOKEN_EXPIRES_IN = "8h";
const TRUSTED_DEVICE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE";
};

export type AuthSession = {
  token: string;
  user: SafeUser;
  trustedDeviceToken?: string;
};

export type AuthTokenPayload = {
  sub: string;
  tokenType: "internal";
  email: string;
  role: UserRole;
};

function requireJwtSecret(): string {
  if (!env.JWT_SECRET) {
    throw new HttpError(500, "Authentication is not configured.", {
      code: "AUTH_NOT_CONFIGURED"
    });
  }

  return env.JWT_SECRET;
}

function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status
  };
}

function invalidCredentials(): HttpError {
  return new HttpError(401, "Invalid email or password.", {
    code: "INVALID_CREDENTIALS"
  });
}

function invalidTrustedDevice(): HttpError {
  return new HttpError(401, "Device verification failed. Please sign in again.", {
    code: "TRUSTED_DEVICE_INVALID"
  });
}

function signAuthToken(user: SafeUser): string {
  return jwt.sign(
    {
      tokenType: "internal",
      email: user.email,
      role: user.role
    },
    requireJwtSecret(),
    {
      expiresIn: TOKEN_EXPIRES_IN,
      subject: user.id
    }
  );
}

function generateTrustedDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashTrustedDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function createTrustedDeviceSession(userId: string, userAgent?: string) {
  const trustedDeviceToken = generateTrustedDeviceToken();

  await prisma.trustedDevice.create({
    data: {
      userId,
      tokenHash: hashTrustedDeviceToken(trustedDeviceToken),
      deviceLabel: "This device",
      userAgent: userAgent?.slice(0, 255),
      expiresAt: new Date(Date.now() + TRUSTED_DEVICE_LIFETIME_MS)
    }
  });

  return trustedDeviceToken;
}

export async function loginWithPassword(
  credentials: LoginRequestBody,
  options: { userAgent?: string } = {}
): Promise<AuthSession> {
  const user = await prisma.user.findUnique({
    where: {
      email: credentials.email
    }
  });

  if (!user) {
    throw invalidCredentials();
  }

  if (!user.passwordHash.startsWith("scrypt$")) {
    throw new HttpError(
      409,
      "Account password is not ready. Please run the development seed or reset this account.",
      {
        code: "PASSWORD_HASH_UNSUPPORTED"
      }
    );
  }

  if (user.status !== "ACTIVE") {
    throw new HttpError(403, "User account is inactive.", {
      code: "USER_INACTIVE"
    });
  }

  const passwordMatches = await verifyPassword(credentials.password, user.passwordHash);

  if (!passwordMatches) {
    throw invalidCredentials();
  }

  const safeUser = toSafeUser(user);

  return {
    token: signAuthToken(safeUser),
    trustedDeviceToken: await createTrustedDeviceSession(user.id, options.userAgent),
    user: safeUser
  };
}

export async function registerLocalUser(input: RegisterRequestBody): Promise<AuthSession> {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: input.email
    }
  });

  if (existingUser) {
    throw new HttpError(409, "An account with this email already exists.", {
      code: "EMAIL_ALREADY_REGISTERED"
    });
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      status: "ACTIVE"
    }
  });

  const safeUser = toSafeUser(user);

  return {
    token: signAuthToken(safeUser),
    user: safeUser
  };
}

export async function restoreTrustedDeviceSession(
  input: TrustedDeviceRequestBody
): Promise<AuthSession> {
  const tokenHash = hashTrustedDeviceToken(input.trustedDeviceToken);
  const trustedDevice = await prisma.trustedDevice.findUnique({
    include: {
      user: true
    },
    where: {
      tokenHash
    }
  });

  if (!trustedDevice) {
    throw invalidTrustedDevice();
  }

  if (trustedDevice.revokedAt) {
    throw new HttpError(401, "This device was forgotten. Please sign in again.", {
      code: "TRUSTED_DEVICE_REVOKED"
    });
  }

  if (!trustedDevice.expiresAt || trustedDevice.expiresAt.getTime() <= Date.now()) {
    throw invalidTrustedDevice();
  }

  if (!trustedDevice.user || trustedDevice.user.status !== "ACTIVE") {
    throw new HttpError(401, "Account access is inactive. Please contact the owner.", {
      code: "TRUSTED_DEVICE_USER_UNAVAILABLE"
    });
  }

  const safeUser = toSafeUser(trustedDevice.user);

  await prisma.trustedDevice.update({
    data: {
      lastUsedAt: new Date()
    },
    where: {
      id: trustedDevice.id
    }
  });

  return {
    token: signAuthToken(safeUser),
    user: safeUser
  };
}

export async function revokeTrustedDevice(input: TrustedDeviceRequestBody): Promise<void> {
  const tokenHash = hashTrustedDeviceToken(input.trustedDeviceToken);
  const trustedDevice = await prisma.trustedDevice.findUnique({
    where: {
      tokenHash
    }
  });

  if (!trustedDevice || trustedDevice.revokedAt) {
    return;
  }

  await prisma.trustedDevice.update({
    data: {
      revokedAt: new Date()
    },
    where: {
      id: trustedDevice.id
    }
  });
}

export async function getUserFromToken(token: string): Promise<SafeUser> {
  let payload: AuthTokenPayload;

  try {
    const verified = jwt.verify(token, requireJwtSecret());

    if (typeof verified === "string" || !verified.sub || verified.tokenType !== "internal") {
      throw new Error("Invalid token payload.");
    }

    payload = {
      sub: verified.sub,
      tokenType: "internal",
      email: String(verified.email ?? ""),
      role: verified.role as UserRole
    };
  } catch {
    throw new HttpError(401, "Authentication token is invalid or expired.", {
      code: "INVALID_AUTH_TOKEN"
    });
  }

  const user = await prisma.user.findUnique({
    where: {
      id: payload.sub
    }
  });

  if (!user || user.status !== "ACTIVE") {
    throw new HttpError(401, "Authenticated user is no longer available.", {
      code: "AUTH_USER_UNAVAILABLE"
    });
  }

  return toSafeUser(user);
}
