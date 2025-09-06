import React from 'react';
import { ApplicationProvider } from './ApplicationContext';
import { ConfigProvider } from './ConfigContext';
import { UIStateProvider } from './UIStateContext';

interface ContextProvidersProps {
  children: React.ReactNode;
  applicationConfig?: Record<string, unknown>;
  uiState?: Record<string, unknown>;
}

/**
 * Combined context provider component that wraps all application contexts
 * with proper nesting order and TypeScript support.
 *
 * Order of providers (outer to inner):
 * 1. ApplicationProvider - dependency injection (outermost)
 * 2. ConfigProvider - configuration management
 * 3. UIStateProvider - UI state management (innermost)
 *
 * This order ensures that:
 * - Services can be injected at the top level
 * - Config can use injected services
 * - UI state can access both services and config
 */
export const ContextProviders: React.FC<ContextProvidersProps> = ({
  children,
  applicationConfig,
  uiState,
}) => {
  return (
    <ApplicationProvider>
      <ConfigProvider initialConfig={applicationConfig}>
        <UIStateProvider initialState={uiState}>{children}</UIStateProvider>
      </ConfigProvider>
    </ApplicationProvider>
  );
};
