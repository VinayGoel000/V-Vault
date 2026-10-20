import type { IUnlockVerifier } from "./verifier.interface";

/**
 * Adapter boundary for a future Electron/Windows Hello integration.
 *
 * Windows Hello itself is initiated by the operating system through the
 * frontend. This backend accepts only the resulting boolean and never sees a
 * Windows password, PIN, or biometric value.
 */
export class WindowsHelloVerifier implements IUnlockVerifier {
  public async verify(credential: unknown): Promise<boolean> {
    return credential === true;
  }
}
