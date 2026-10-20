import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, api, getErrorMessage } from "../api/client";
import type { CardSummary, VaultStage, VaultStatus } from "../api/types";
import { useToast } from "./ToastContext";

interface VaultContextValue {
  stage: VaultStage;
  status: VaultStatus | null;
  cards: CardSummary[];
  setupVault: (masterPassword: string) => Promise<void>;
  unlockVault: (masterPassword: string) => Promise<void>;
  lockVault: (reason?: "manual" | "idle") => Promise<void>;
  refreshCards: () => Promise<CardSummary[]>;
  markLocked: () => void;
  reportError: (error: unknown) => void;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const { success, error: showError } = useToast();
  const [stage, setStage] = useState<VaultStage>("boot");
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [cards, setCards] = useState<CardSummary[]>([]);

  const markLocked = useCallback(() => {
    setStage("locked");
    setStatus((current) => (current ? { ...current, isUnlocked: false } : current));
    setCards([]);
  }, []);

  const reportError = useCallback(
    (caughtError: unknown) => {
      if (caughtError instanceof ApiError && caughtError.status === 423) {
        markLocked();
      }
      showError(getErrorMessage(caughtError));
    },
    [markLocked, showError],
  );

  const refreshCards = useCallback(async () => {
    try {
      const nextCards = await api.listCards();
      setCards(nextCards);
      return nextCards;
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 423) {
        markLocked();
      }
      throw caughtError;
    }
  }, [markLocked]);

  const syncStatus = useCallback(async () => {
    const nextStatus = await api.getStatus();
    setStatus(nextStatus);

    if (!nextStatus.isSetup) {
      setCards([]);
      setStage("setup");
      return;
    }

    if (!nextStatus.isUnlocked) {
      setCards([]);
      setStage("locked");
      return;
    }

    setStage("ready");
    try {
      await refreshCards();
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 423) {
        markLocked();
      } else {
        throw caughtError;
      }
    }
  }, [markLocked, refreshCards]);

  useEffect(() => {
    let active = true;
    void syncStatus().catch((caughtError: unknown) => {
      if (active) {
        setStage("locked");
        showError(getErrorMessage(caughtError));
      }
    });
    return () => {
      active = false;
    };
  }, [showError, syncStatus]);

  const setupVault = useCallback(
    async (masterPassword: string) => {
      await api.setup(masterPassword);
      success("Your vault is ready. Unlock it to continue.");
      await syncStatus();
    },
    [success, syncStatus],
  );

  const unlockVault = useCallback(
    async (masterPassword: string) => {
      await api.unlock(masterPassword);
      const nextCards = await api.listCards();
      setCards(nextCards);
      setStatus({ isSetup: true, isUnlocked: true });
      setStage("ready");
      success("Vault unlocked.");
    },
    [success],
  );

  const lockVault = useCallback(
    async (reason: "manual" | "idle" = "manual") => {
      try {
        await api.lock();
      } catch (caughtError) {
        showError(getErrorMessage(caughtError));
      } finally {
        markLocked();
        if (reason === "idle") {
          success("Your vault was locked after five minutes of inactivity.");
        }
      }
    },
    [markLocked, showError, success],
  );

  const value = useMemo(
    () => ({
      stage,
      status,
      cards,
      setupVault,
      unlockVault,
      lockVault,
      refreshCards,
      markLocked,
      reportError,
    }),
    [
      cards,
      lockVault,
      markLocked,
      refreshCards,
      reportError,
      setupVault,
      stage,
      status,
      unlockVault,
    ],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const context = useContext(VaultContext);
  if (context === null) {
    throw new Error("useVault must be used inside VaultProvider");
  }
  return context;
}
