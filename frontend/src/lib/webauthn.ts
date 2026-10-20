export type PlatformAuthenticatorResult = {
  status: "unsupported" | "mismatch";
  message: string;
};

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (
    !window.isSecureContext ||
    !navigator.credentials ||
    typeof PublicKeyCredential === "undefined" ||
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !==
      "function"
  ) {
    return false;
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Starts a browser platform-authenticator ceremony without ever reading or
 * forwarding a PIN, password, biometric value, or credential payload.
 *
 * The current backend only accepts POST /vault/unlock with { masterPassword }.
 * There is no server-issued WebAuthn challenge or credential exchange route,
 * so even a browser ceremony cannot unlock this vault. The returned mismatch
 * result is intentionally explicit instead of pretending that it authenticated.
 */
export async function attemptPlatformAuthenticator(): Promise<PlatformAuthenticatorResult> {
  if (
    !window.isSecureContext ||
    !navigator.credentials ||
    typeof PublicKeyCredential === "undefined"
  ) {
    return {
      status: "unsupported",
      message:
        "Platform authentication is unavailable here. Use your V-Vault master password.",
    };
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        timeout: 60_000,
        userVerification: "required",
        allowCredentials: [],
      },
    });

    return {
      status: "mismatch",
      message:
        "Your platform authenticator completed, but this backend has no WebAuthn unlock route. No credential was sent; use the master password instead.",
    };
  } catch (error: unknown) {
    const name = error instanceof DOMException ? error.name : "";
    const message =
      name === "NotAllowedError" || name === "AbortError"
        ? "Platform authentication was cancelled or no matching credential was available. This backend unlocks with the master password."
        : "Platform authentication could not be completed for this browser. This backend unlocks with the master password.";

    return {
      status: "unsupported",
      message,
    };
  }
}
