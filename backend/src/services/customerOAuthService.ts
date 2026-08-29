import type { CustomerSocialProvider } from "@prisma/client";

import {
  authenticateCustomerSocialIdentity,
  type CustomerSocialAuthResult
} from "./customerSocialAuthService.js";
import type { CustomerOAuthProvider } from "./customerOAuthProviderService.js";
import {
  consumeCustomerOAuthTransaction,
  createCustomerOAuthTransaction
} from "./customerOAuthTransactionService.js";

export type CustomerWebOAuthStartResult = {
  authorizationUrl: URL;
  browserBinding: string;
  expiresAt: Date;
};

export type CustomerWebOAuthCompleteResult = CustomerSocialAuthResult & {
  returnPath: string;
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
