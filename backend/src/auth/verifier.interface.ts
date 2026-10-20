export interface IUnlockVerifier {
  verify(credential: unknown): Promise<boolean>;
}
