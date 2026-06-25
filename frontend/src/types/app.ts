export type AppEnvironment = "development" | "test" | "production";

export type AppMetadata = {
  name: string;
  version: string;
  environment: AppEnvironment;
};
