import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';

interface ConfigContextValue<T = Record<string, unknown>> {
  config: T | undefined;
  updateConfig: (newConfig: Partial<T>) => void;
  getConfigValue: (path: string) => unknown;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

interface ConfigProviderProps<T = Record<string, unknown>> {
  children: React.ReactNode;
  initialConfig?: T;
}

// Helper function to get nested values from objects using dot notation
const getNestedValue = (obj: unknown, path: string): unknown => {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }

  return path
    .split('.')
    .reduce((current: Record<string, unknown>, key: string) => {
      return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
};

export const ConfigProvider = <
  T extends Record<string, unknown> = Record<string, unknown>,
>({
  children,
  initialConfig,
}: ConfigProviderProps<T>): JSX.Element => {
  const [config, setConfig] = useState<T | undefined>(initialConfig);

  const updateConfig = useCallback((newConfig: Partial<T>): void => {
    setConfig((prevConfig) => {
      if (!prevConfig) {
        return newConfig as T;
      }
      return { ...prevConfig, ...newConfig };
    });
  }, []);

  const getConfigValue = useCallback(
    (path: string): unknown => {
      if (!config) {
        return undefined;
      }
      return getNestedValue(config, path);
    },
    [config]
  );

  const contextValue = useMemo<ConfigContextValue<T>>(
    () => ({
      config,
      updateConfig,
      getConfigValue,
    }),
    [config, updateConfig, getConfigValue]
  );

  return (
    <ConfigContext.Provider value={contextValue as ConfigContextValue}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = <
  T extends Record<string, unknown> = Record<string, unknown>,
>(): ConfigContextValue<T> => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return context as ConfigContextValue<T>;
};
