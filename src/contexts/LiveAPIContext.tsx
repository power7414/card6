/**
 * 擴展的 LiveAPI Context，支援多聊天室狀態管理
 */

import { createContext, FC, ReactNode, useContext, useState, useCallback } from "react";
import { useLiveAPI, UseLiveAPIResults } from "../hooks/use-live-api";
import { LiveClientOptions } from "../types";
import { ErrorBoundary } from "../components/shared/ErrorBoundary";

interface LiveAPIContextValue extends UseLiveAPIResults {
  error: string | null;
  clearError: () => void;
  resetAIResponseState?: () => void;
}

const LiveAPIContext = createContext<LiveAPIContextValue | undefined>(undefined);

export type LiveAPIProviderProps = {
  children: ReactNode;
  options: LiveClientOptions;
  fallback?: ReactNode;
};

const LiveAPIProviderContent: FC<LiveAPIProviderProps> = ({
  options,
  children,
}) => {
  const liveAPI = useLiveAPI(options);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((error: Error) => {
    setError(error.message);
    console.error('LiveAPI Context Error:', error);
  }, []);

  const contextValue: LiveAPIContextValue = {
    ...liveAPI,
    error,
    clearError
  };

  return (
    <LiveAPIContext.Provider value={contextValue}>
      <ErrorBoundary 
        onError={handleError}
        fallback={
          <div className="live-api-error">
            <h3>Live API Connection Error</h3>
            <p>{error}</p>
            <button onClick={clearError}>Retry</button>
          </div>
        }
      >
        {children}
      </ErrorBoundary>
    </LiveAPIContext.Provider>
  );
};

export const LiveAPIProvider: FC<LiveAPIProviderProps> = ({
  options,
  children,
  fallback
}) => {
  return (
    <ErrorBoundary 
      fallback={fallback || (
        <div className="live-api-provider-error">
          <h2>Failed to initialize Live API</h2>
          <p>Please check your API configuration and try again.</p>
        </div>
      )}
    >
      <LiveAPIProviderContent options={options}>
        {children}
      </LiveAPIProviderContent>
    </ErrorBoundary>
  );
};

export const useLiveAPIContext = () => {
  const context = useContext(LiveAPIContext);
  if (!context) {
    throw new Error("useLiveAPIContext must be used within a LiveAPIProvider");
  }
  return context;
};