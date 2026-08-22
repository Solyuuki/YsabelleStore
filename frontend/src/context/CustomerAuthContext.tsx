import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import {
  getCurrentCustomer,
  loginCustomer,
  logoutCustomer,
  registerCustomer
} from "@/services/customerAuthService";
import type {
  Customer,
  CustomerAuthStatus,
  CustomerLoginInput,
  CustomerRegisterInput
} from "@/types/customerAuth";
import { resolveCustomerAuthStatus } from "./customerAuthState";

type CustomerAuthContextValue = {
  customer: Customer | null;
  error: string | null;
  isReady: boolean;
  login: (input: CustomerLoginInput) => Promise<Customer>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<Customer | null>;
  register: (input: CustomerRegisterInput) => Promise<Customer>;
  status: CustomerAuthStatus;
};

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const restoredCustomer = await getCurrentCustomer();
      setCustomer(restoredCustomer);
      setError(null);
      return restoredCustomer;
    } catch {
      setCustomer(null);
      setError("Customer session could not be checked. You can continue shopping as a guest.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (input: CustomerLoginInput) => {
    const authenticatedCustomer = await loginCustomer(input);
    setCustomer(authenticatedCustomer);
    setError(null);
    setLoading(false);
    return authenticatedCustomer;
  }, []);

  const register = useCallback(async (input: CustomerRegisterInput) => {
    const registeredCustomer = await registerCustomer(input);
    setCustomer(registeredCustomer);
    setError(null);
    setLoading(false);
    return registeredCustomer;
  }, []);

  const logout = useCallback(async () => {
    let logoutError: unknown = null;

    try {
      await logoutCustomer();
    } catch (caughtError) {
      logoutError = caughtError;
    } finally {
      setCustomer(null);
      setLoading(false);
    }

    if (logoutError) {
      setError("You are signed out locally, but the server session could not be confirmed revoked.");
      throw logoutError;
    }

    setError(null);
  }, []);

  const status = resolveCustomerAuthStatus(customer, loading);
  const value = useMemo<CustomerAuthContextValue>(
    () => ({
      customer,
      error,
      isReady: !loading,
      login,
      logout,
      refreshSession,
      register,
      status
    }),
    [customer, error, loading, login, logout, refreshSession, register, status]
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);

  if (!context) {
    throw new Error("useCustomerAuth must be used inside CustomerAuthProvider.");
  }

  return context;
}
