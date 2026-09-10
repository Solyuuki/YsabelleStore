export type CustomerAuthStatus = "loading" | "authenticated" | "unauthenticated";

export type CustomerAccountStatus = "ACTIVE" | "INACTIVE";

export type Customer = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  phone: string | null;
  status: CustomerAccountStatus;
};

export type CustomerLoginInput = {
  identifier: string;
  password: string;
};

export type CustomerRegisterInput = {
  name: string;
  username: string;
  email: string;
  phone?: string;
  password: string;
};

export type CustomerAuthErrorPayload = {
  code?: string;
  details?: unknown;
};
