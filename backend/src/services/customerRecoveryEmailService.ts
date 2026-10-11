import type { CustomerRecoveryEmailDelivery } from "./customerPasswordRecoveryService.js";
import {
  CustomerIdentityEmailDeliveryError,
  sendCustomerIdentityVerificationEmail
} from "./customerIdentityEmailDeliveryService.js";

export class CustomerRecoveryEmailDeliveryError extends Error {
  constructor() {
    super("Customer recovery email delivery failed.");
    this.name = "CustomerRecoveryEmailDeliveryError";
  }
}

export const customerRecoveryEmailDelivery: CustomerRecoveryEmailDelivery = {
  async sendPasswordRecoveryEmail({ to, verificationCode }) {
    try {
      await sendCustomerIdentityVerificationEmail({
        to,
        verificationCode,
        purpose: "password_recovery"
      });
    } catch (error) {
      if (error instanceof CustomerIdentityEmailDeliveryError) {
        throw new CustomerRecoveryEmailDeliveryError();
      }
      throw error;
    }
  }
};
