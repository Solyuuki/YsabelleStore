export type AuthUserRole = "OWNER" | "STAFF";
export type AuthUserStatus = "ACTIVE" | "INACTIVE";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: AuthUserRole;
  status: AuthUserStatus;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};
