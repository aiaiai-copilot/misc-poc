import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';

interface UIStateContextValue<T = Record<string, unknown>> {
  state: T | undefined;
  updateState: (newState: Partial<T>) => void;
  resetState: () => void;
  toggleState: (key: keyof T) => void;
}

const UIStateContext = createContext<UIStateContextValue | undefined>(
  undefined
);

interface UIStateProviderProps<T = Record<string, unknown>> {
  children: React.ReactNode;
  initialState?: T;
}

export const UIStateProvider = <
  T extends Record<string, unknown> = Record<string, unknown>,
>({
  children,
  initialState,
}: UIStateProviderProps<T>): JSX.Element => {
  const [state, setState] = useState<T | undefined>(initialState);

  const updateState = useCallback((newState: Partial<T>): void => {
    setState((prevState) => {
      if (!prevState) {
        return newState as T;
      }
      return { ...prevState, ...newState };
    });
  }, []);

  const resetState = useCallback((): void => {
    setState(initialState);
  }, [initialState]);

  const toggleState = useCallback((key: keyof T): void => {
    setState((prevState) => {
      if (!prevState) {
        return { [key]: true } as T;
      }

      const currentValue = prevState[key];
      if (typeof currentValue === 'boolean') {
        return { ...prevState, [key]: !currentValue };
      }

      // If not a boolean, treat it as a toggle between truthy/falsy
      return { ...prevState, [key]: !currentValue } as T;
    });
  }, []);

  const contextValue = useMemo<UIStateContextValue<T>>(
    () => ({
      state,
      updateState,
      resetState,
      toggleState,
    }),
    [state, updateState, resetState, toggleState]
  );

  return (
    <UIStateContext.Provider value={contextValue as UIStateContextValue}>
      {children}
    </UIStateContext.Provider>
  );
};

export const useUIState = <
  T extends Record<string, unknown> = Record<string, unknown>,
>(): UIStateContextValue<T> => {
  const context = useContext(UIStateContext);
  if (context === undefined) {
    throw new Error('useUIState must be used within UIStateProvider');
  }
  return context as UIStateContextValue<T>;
};
