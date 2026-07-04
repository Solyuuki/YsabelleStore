import jwt from "jsonwebtoken";
import type { User, UserRole } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import type { LoginRequestBody } from "../validators/auth.validators.js";
import { verifyPassword } from "./passwordHashService.js";

const TOKEN_EXPIRES_IN = "8h";

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
};

export type AuthTokenPayload = {
  sub: string;
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

function signAuthToken(user: SafeUser): string {
  return jwt.sign(
    {
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

export async function loginWithPassword(credentials: LoginRequestBody): Promise<AuthSession> {
  const user = await prisma.user.findUnique({
    where: {
      email: credentials.email
    }
  });

  if (!user) {
    throw new HttpError(401, "Invalid email or password.", {
      code: "INVALID_CREDENTIALS"
    });
  }

  if (user.status !== "ACTIVE") {
    throw new HttpError(403, "User account is inactive.", {
      code: "USER_INACTIVE"
    });
  }

  const passwordMatches = await verifyPassword(credentials.password, user.passwordHash);

  if (!passwordMatches) {
    throw new HttpError(401, "Invalid email or password.", {
      code: "INVALID_CREDENTIALS"
    });
  }

  const safeUser = toSafeUser(user);

  return {
    token: signAuthToken(safeUser),
    user: safeUser
  };
}

export async function getUserFromToken(token: string): Promise<SafeUser> {
  let payload: AuthTokenPayload;

  try {
    const verified = jwt.verify(token, requireJwtSecret());

    if (typeof verified === "string" || !verified.sub) {
      throw new Error("Invalid token payload.");
    }

    payload = {
      sub: verified.sub,
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
