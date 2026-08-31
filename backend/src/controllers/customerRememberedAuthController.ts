import type { CustomerRememberedAuthMethod } from "@prisma/client";
import type { RequestHandler } from "express";

import {
  requestCustomerEmailAuth,
  verifyCustomerEmailAuth
} from "../services/customerEmailAuthService.js";
import { CustomerIdentityEmailDeliveryError } from "../services/customerIdentityEmailDeliveryService.js";
import {
  continueRememberedCustomer,
  forgetRememberedCustomer,
  getCustomerRememberedAuthRow,
  listCustomerRememberedAccounts,
  rememberCustomerAccount
} from "../services/customerRememberedAuthService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { setCustomerSessionCookie } from "../utils/customerAuthCookie.js";
import {
  ensureCustomerRememberedBrowserCredential,
  hashCustomerRememberedBrowserToken,
  readCustomerRememberedBrowserCookie
} from "../utils/customerRememberedAuthCookie.js";
import { HttpError } from "../utils/httpError.js";
import {
  customerRememberedContinueSchema,
  customerRememberedVerifySchema
} from "../validators/customerAuth.validators.js";

function invalidRememberedAccount(): HttpError {
  return new HttpError(400, "This remembered account is no longer available on this browser.", {
    code: "CUSTOMER_REMEMBERED_ACCOUNT_INVALID"
  });
}

function browserTokenHashFromRequest(request: Parameters<RequestHandler>[0]): string | null {
  const token = readCustomerRememberedBrowserCookie(request);
  return token ? hashCustomerRememberedBrowserToken(token) : null;
}

export async function rememberAuthenticatedCustomerForBrowser(input: {
  request: Parameters<RequestHandler>[0];
  response: Parameters<RequestHandler>[1];
  customerAccountId: string;
  authMethod: CustomerRememberedAuthMethod;
  rememberFor30Days: boolean;
}) {
  if (!input.rememberFor30Days || input.authMethod !== "EMAIL") {
    return { remembered: false, slotLimitReached: false };
  }

  const { tokenHash } = ensureCustomerRememberedBrowserCredential(input.request, input.response);
  return rememberCustomerAccount({
    authMethod: "EMAIL",
    browserTokenHash: tokenHash,
    customerAccountId: input.customerAccountId
  });
}

export const listCustomerRememberedAuthAccounts: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const browserTokenHash = browserTokenHashFromRequest(request);
    const accounts = browserTokenHash ? await listCustomerRememberedAccounts(browserTokenHash) : [];

    response.status(200).json(
      createSuccessResponse("Remembered customer accounts loaded.", {
        accounts,
        maxAccounts: 3
      })
    );
  } catch (error) {
    next(error);
  }
};

export const continueCustomerRememberedAuthAccount: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const parsedBody = customerRememberedContinueSchema.safeParse(request.body);
    if (!parsedBody.success) throw invalidRememberedAccount();

    const browserTokenHash = browserTokenHashFromRequest(request);
    if (!browserTokenHash) throw invalidRememberedAccount();

    const result = await continueRememberedCustomer({
      browserTokenHash,
      rememberedAccountId: parsedBody.data.rememberedAccountId
    });

    if (result.status === "invalid") throw invalidRememberedAccount();
    if (result.status === "verification_required") {
      response.status(200).json(
        createSuccessResponse(
          "Verification is required to continue with this remembered account.",
          {
            verificationRequired: true,
            account: result.account
          }
        )
      );
      return;
    }

    setCustomerSessionCookie(response, result.session.sessionToken);
    response.status(200).json(
      createSuccessResponse("Remembered customer sign-in successful.", {
        verificationRequired: false,
        customer: result.session.customer
      })
    );
  } catch (error) {
    next(error);
  }
};

export const requestCustomerRememberedAuthVerification: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const parsedBody = customerRememberedContinueSchema.safeParse(request.body);
    if (!parsedBody.success) throw invalidRememberedAccount();

    const browserTokenHash = browserTokenHashFromRequest(request);
    if (!browserTokenHash) throw invalidRememberedAccount();

    const row = await getCustomerRememberedAuthRow({
      browserTokenHash,
      rememberedAccountId: parsedBody.data.rememberedAccountId
    });
    if (!row || row.customerAccount.status !== "ACTIVE") {
      throw invalidRememberedAccount();
    }

    try {
      await requestCustomerEmailAuth({ email: row.customerAccount.email });
    } catch (error) {
      if (error instanceof CustomerIdentityEmailDeliveryError) {
        console.error(JSON.stringify({ event: "customer_remembered_auth_delivery_failed" }));
      } else {
        throw error;
      }
    }

    const safeAccount = (await listCustomerRememberedAccounts(browserTokenHash)).find(
      (candidate) => candidate.id === row.id
    );

    response.status(200).json(
      createSuccessResponse("A verification code will be sent for this remembered account.", {
        account: safeAccount ?? null
      })
    );
  } catch (error) {
    next(error);
  }
};

export const verifyCustomerRememberedAuthAccount: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const parsedBody = customerRememberedVerifySchema.safeParse(request.body);
    if (!parsedBody.success) throw invalidRememberedAccount();

    const browserTokenHash = browserTokenHashFromRequest(request);
    if (!browserTokenHash) throw invalidRememberedAccount();

    const row = await getCustomerRememberedAuthRow({
      browserTokenHash,
      rememberedAccountId: parsedBody.data.rememberedAccountId
    });
    if (!row || row.customerAccount.status !== "ACTIVE") {
      throw invalidRememberedAccount();
    }

    const session = await verifyCustomerEmailAuth({
      email: row.customerAccount.email,
      verificationCode: parsedBody.data.verificationCode
    });

    await rememberCustomerAccount({
      authMethod: "EMAIL",
      browserTokenHash,
      customerAccountId: row.customerAccountId
    });
    setCustomerSessionCookie(response, session.sessionToken);

    response.status(200).json(
      createSuccessResponse("Remembered customer verification successful.", {
        customer: session.customer
      })
    );
  } catch (error) {
    next(error);
  }
};

export const forgetCustomerRememberedAuthAccount: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const rememberedAccountId = request.params.id?.trim();
    const browserTokenHash = browserTokenHashFromRequest(request);
    if (!rememberedAccountId || !browserTokenHash) {
      throw invalidRememberedAccount();
    }

    await forgetRememberedCustomer({ browserTokenHash, rememberedAccountId });
    response
      .status(200)
      .json(createSuccessResponse("Remembered account removed from this browser."));
  } catch (error) {
    next(error);
  }
};
