export class LmsIntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LmsIntegrationError";
  }
}

export class LmsProviderNotConfiguredError extends LmsIntegrationError {
  constructor(provider: string) {
    super(`LMS provider is not configured: ${provider}`);
    this.name = "LmsProviderNotConfiguredError";
  }
}

