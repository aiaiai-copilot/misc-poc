import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigProvider, useConfig } from './ConfigContext';

interface TestConfig {
  apiUrl: string;
  version: string;
  features: {
    enableFeatureA: boolean;
    enableFeatureB: boolean;
  };
}

const defaultConfig: TestConfig = {
  apiUrl: 'https://api.example.com',
  version: '1.0.0',
  features: {
    enableFeatureA: true,
    enableFeatureB: false,
  },
};

const TestComponent: React.FC = () => {
  const { config, updateConfig, getConfigValue } = useConfig<TestConfig>();

  const handleUpdateApiUrl = (): void => {
    updateConfig({ apiUrl: 'https://new-api.example.com' });
  };

  const handleUpdateFeature = (): void => {
    updateConfig({
      features: {
        ...(config?.features || {}),
        enableFeatureB: true,
      },
    });
  };

  return (
    <div>
      <div data-testid="api-url">{config?.apiUrl || 'no config'}</div>
      <div data-testid="version">{config?.version || 'no version'}</div>
      <div data-testid="feature-a">
        {getConfigValue('features.enableFeatureA') ? 'enabled' : 'disabled'}
      </div>
      <div data-testid="feature-b">
        {getConfigValue('features.enableFeatureB') ? 'enabled' : 'disabled'}
      </div>
      <button onClick={handleUpdateApiUrl} data-testid="update-api-btn">
        Update API
      </button>
      <button onClick={handleUpdateFeature} data-testid="update-feature-btn">
        Update Feature
      </button>
    </div>
  );
};

describe('ConfigContext', () => {
  it('throws error when used outside provider', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useConfig must be used within ConfigProvider');

    consoleError.mockRestore();
  });

  it('provides initial config and allows updates', () => {
    render(
      <ConfigProvider initialConfig={defaultConfig}>
        <TestComponent />
      </ConfigProvider>
    );

    expect(screen.getByTestId('api-url')).toHaveTextContent(
      'https://api.example.com'
    );
    expect(screen.getByTestId('version')).toHaveTextContent('1.0.0');
    expect(screen.getByTestId('feature-a')).toHaveTextContent('enabled');
    expect(screen.getByTestId('feature-b')).toHaveTextContent('disabled');

    fireEvent.click(screen.getByTestId('update-api-btn'));

    expect(screen.getByTestId('api-url')).toHaveTextContent(
      'https://new-api.example.com'
    );
  });

  it('allows partial config updates', () => {
    render(
      <ConfigProvider initialConfig={defaultConfig}>
        <TestComponent />
      </ConfigProvider>
    );

    expect(screen.getByTestId('feature-b')).toHaveTextContent('disabled');
    expect(screen.getByTestId('version')).toHaveTextContent('1.0.0'); // Should remain unchanged

    fireEvent.click(screen.getByTestId('update-feature-btn'));

    expect(screen.getByTestId('feature-b')).toHaveTextContent('enabled');
    expect(screen.getByTestId('version')).toHaveTextContent('1.0.0'); // Should still be unchanged
  });

  it('handles nested config value retrieval', () => {
    const NestedConfigTest: React.FC = () => {
      const { getConfigValue } = useConfig<TestConfig>();

      return (
        <div>
          <div data-testid="nested-value">
            {String(getConfigValue('features.enableFeatureA'))}
          </div>
          <div data-testid="top-level-value">{getConfigValue('version')}</div>
          <div data-testid="non-existent">
            {String(getConfigValue('nonExistent.path') || 'undefined')}
          </div>
        </div>
      );
    };

    render(
      <ConfigProvider initialConfig={defaultConfig}>
        <NestedConfigTest />
      </ConfigProvider>
    );

    expect(screen.getByTestId('nested-value')).toHaveTextContent('true');
    expect(screen.getByTestId('top-level-value')).toHaveTextContent('1.0.0');
    expect(screen.getByTestId('non-existent')).toHaveTextContent('undefined');
  });

  it('works without initial config', () => {
    const NoInitialConfigTest: React.FC = () => {
      const { config, updateConfig } = useConfig<TestConfig>();

      const handleSetConfig = (): void => {
        updateConfig({ apiUrl: 'https://set-later.com', version: '2.0.0' });
      };

      return (
        <div>
          <div data-testid="config-state">
            {config ? 'has config' : 'no config'}
          </div>
          <div data-testid="api-url">{config?.apiUrl || 'not set'}</div>
          <button onClick={handleSetConfig} data-testid="set-config-btn">
            Set Config
          </button>
        </div>
      );
    };

    render(
      <ConfigProvider>
        <NoInitialConfigTest />
      </ConfigProvider>
    );

    expect(screen.getByTestId('config-state')).toHaveTextContent('no config');
    expect(screen.getByTestId('api-url')).toHaveTextContent('not set');

    fireEvent.click(screen.getByTestId('set-config-btn'));

    expect(screen.getByTestId('config-state')).toHaveTextContent('has config');
    expect(screen.getByTestId('api-url')).toHaveTextContent(
      'https://set-later.com'
    );
  });
});
