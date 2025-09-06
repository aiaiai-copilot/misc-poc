import React, { createContext, useContext, useCallback, useMemo } from 'react';

type ServiceRegistry = Map<string, unknown>;

interface ApplicationContextValue {
  registerService: <T>(name: string, service: T) => void;
  getService: <T>(name: string) => T | undefined;
}

const ApplicationContext = createContext<ApplicationContextValue | undefined>(
  undefined
);

interface ApplicationProviderProps {
  children: React.ReactNode;
}

export const ApplicationProvider: React.FC<ApplicationProviderProps> = ({
  children,
}) => {
  const serviceRegistry = useMemo<ServiceRegistry>(() => new Map(), []);

  const registerService = useCallback(
    <T,>(name: string, service: T): void => {
      serviceRegistry.set(name, service);
    },
    [serviceRegistry]
  );

  const getService = useCallback(
    <T,>(name: string): T | undefined => {
      return serviceRegistry.get(name) as T | undefined;
    },
    [serviceRegistry]
  );

  const contextValue = useMemo<ApplicationContextValue>(
    () => ({
      registerService,
      getService,
    }),
    [registerService, getService]
  );

  return (
    <ApplicationContext.Provider value={contextValue}>
      {children}
    </ApplicationContext.Provider>
  );
};

export const useApplication = (): ApplicationContextValue => {
  const context = useContext(ApplicationContext);
  if (context === undefined) {
    throw new Error('useApplication must be used within ApplicationProvider');
  }
  return context;
};
