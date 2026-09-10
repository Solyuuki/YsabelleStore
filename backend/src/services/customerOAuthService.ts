import type { CustomerSocialProvider } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import {
  createCustomerSession,
  toSafeCustomer,
  type CustomerSessionResult
} from "./customerAuthService.js";
import {
  authenticateCustomerSocialIdentity,
  type CustomerSocialAuthResult
} from "./customerSocialAuthService.js";
import type { CustomerOAuthProvider } from "./customerOAuthProviderService.js";
import {
  consumeCustomerOAuthTransaction,
  createCustomerOAuthHandoff,
  createCustomerOAuthTransaction,
  redeemCustomerOAuthHandoff
} from "./customerOAuthTransactionService.js";

export type CustomerWebOAuthStartResult = {
  authorizationUrl: URL;
  browserBinding: string;
  expiresAt: Date;
};

export type CustomerWebOAuthCompleteResult = CustomerSocialAuthResult & {
  returnPath: string;
};

export type CustomerElectronOAuthStartResult = {
  authorizationUrl: URL;
  expiresAt: Date;
};

export type CustomerElectronOAuthCompleteResult =
  | {
      kind: "authenticated";
      customer: CustomerSessionResult["customer"];
      handoffCode: string;
      expiresAt: Date;
    }
  | {
      kind: "link_required";
    };

export async function startCustomerWebOAuth(
  input: {
    provider: CustomerSocialProvider;
    redirectUri: string;
    returnPath?: string;
  },
  provider: CustomerOAuthProvider,
  now = new Date()
): Promise<CustomerWebOAuthStartResult> {
  const transaction = await createCustomerOAuthTransaction(
    {
      provider: input.provider,
      transport: "WEB",
      returnPath: input.returnPath
    },
    now
  );

  return {
    authorizationUrl: provider.buildAuthorizationUrl({
      redirectUri: input.redirectUri,
      state: transaction.state,
      pkceChallenge: transaction.pkceChallenge,
      nonce: transaction.nonce
    }),
    browserBinding: transaction.browserBinding,
    expiresAt: transaction.expiresAt
  };
}

export async function completeCustomerWebOAuth(
  input: {
    provider: CustomerSocialProvider;
    redirectUri: string;
    state: string;
    browserBinding: string;
    code: string;
  },
  provider: CustomerOAuthProvider,
  now = new Date()
): Promise<CustomerWebOAuthCompleteResult> {
  const transaction = await consumeCustomerOAuthTransaction(
    {
      provider: input.provider,
      transport: "WEB",
      state: input.state,
      browserBinding: input.browserBinding
    },
    now
  );

  const identity = await provider.exchangeCodeForIdentity({
    code: input.code,
    redirectUri: input.redirectUri,
    pkceVerifier: transaction.pkceVerifier,
    nonce: transaction.nonce
  });

  const result = await authenticateCustomerSocialIdentity(identity, now);
  return {
    ...result,
    returnPath: transaction.returnPath
  };
}

export async function startCustomerElectronOAuth(
  input: {
    provider: CustomerSocialProvider;
    redirectUri: string;
    verifierChallenge: string;
  },
  provider: CustomerOAuthProvider,
  now = new Date()
): Promise<CustomerElectronOAuthStartResult> {
  if (
    !input.verifierChallenge ||
    input.verifierChallenge.length < 43 ||
    input.verifierChallenge.length > 86
  ) {
    throw new HttpError(400, "Customer social authentication handoff is invalid.", {
      code: "SOCIAL_AUTH_HANDOFF_INVALID"
    });
  }

  const transaction = await createCustomerOAuthTransaction(
    {
      provider: input.provider,
      transport: "ELECTRON",
      electronChallenge: input.verifierChallenge
    },
    now
  );

  return {
    authorizationUrl: provider.buildAuthorizationUrl({
      redirectUri: input.redirectUri,
      state: transaction.state,
      pkceChallenge: transaction.pkceChallenge,
      nonce: transaction.nonce
    }),
    expiresAt: transaction.expiresAt
  };
}

export async function completeCustomerElectronOAuth(
  input: {
    provider: CustomerSocialProvider;
    redirectUri: string;
    state: string;
    code: string;
  },
  provider: CustomerOAuthProvider,
  now = new Date()
): Promise<CustomerElectronOAuthCompleteResult> {
  const transaction = await consumeCustomerOAuthTransaction(
    {
      provider: input.provider,
      transport: "ELECTRON",
      state: input.state
    },
    now
  );

  if (!transaction.electronChallenge) {
    throw new HttpError(400, "Customer social authentication handoff is invalid.", {
      code: "SOCIAL_AUTH_HANDOFF_INVALID"
    });
  }

  const identity = await provider.exchangeCodeForIdentity({
    code: input.code,
    redirectUri: input.redirectUri,
    pkceVerifier: transaction.pkceVerifier,
    nonce: transaction.nonce
  });
  const result = await authenticateCustomerSocialIdentity(identity, now);

  if (result.kind === "link_required") {
    return { kind: "link_required" };
  }

  const handoff = await createCustomerOAuthHandoff(
    result.customer.id,
    transaction.electronChallenge,
    now
  );

  return {
    kind: "authenticated",
    customer: result.customer,
    handoffCode: handoff.code,
    expiresAt: handoff.expiresAt
  };
}

export async function redeemCustomerElectronOAuth(
  input: { code: string; verifier: string },
  now = new Date()
): Promise<CustomerSessionResult> {
  const customerAccountId = await redeemCustomerOAuthHandoff(input, now);
  const customer = await prisma.customerAccount.findUnique({ where: { id: customerAccountId } });
  if (!customer || customer.status !== "ACTIVE") {
    throw new HttpError(403, "Customer account is unavailable.", {
      code: "SOCIAL_AUTH_ACCOUNT_UNAVAILABLE"
    });
  }

  const session = await createCustomerSession(customer.id, now);
  return {
    customer: toSafeCustomer(customer),
    ...session
  };
}
