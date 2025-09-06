import React, { useEffect, useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplicationProvider, useApplication } from './ApplicationContext';

interface MockService {
  getData: () => string;
}

const mockService: MockService = {
  getData: () => 'mock data',
};

const TestComponent: React.FC = () => {
  const { getService, registerService } = useApplication();
  const [serviceData, setServiceData] = useState<string>('no service');

  const handleRegister = (): void => {
    registerService<MockService>('mockService', mockService);
    const service = getService<MockService>('mockService');
    setServiceData(service?.getData() || 'no service');
  };

  return (
    <div>
      <button onClick={handleRegister} data-testid="register-btn">
        Register Service
      </button>
      <div data-testid="service-data">{serviceData}</div>
    </div>
  );
};

describe('ApplicationContext', () => {
  it('throws error when used outside provider', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useApplication must be used within ApplicationProvider');

    consoleError.mockRestore();
  });

  it('provides dependency injection functionality', () => {
    render(
      <ApplicationProvider>
        <TestComponent />
      </ApplicationProvider>
    );

    expect(screen.getByTestId('service-data')).toHaveTextContent('no service');

    fireEvent.click(screen.getByTestId('register-btn'));

    expect(screen.getByTestId('service-data')).toHaveTextContent('mock data');
  });

  it('allows service registration and retrieval', () => {
    const ServiceRegistration: React.FC = () => {
      const { registerService, getService } = useApplication();
      const [serviceValue, setServiceValue] = useState<string>('not found');

      useEffect(() => {
        registerService('testService', { value: 'test' });
        const service = getService<{ value: string }>('testService');
        setServiceValue(service?.value || 'not found');
      }, [registerService, getService]);

      return <div data-testid="service-value">{serviceValue}</div>;
    };

    render(
      <ApplicationProvider>
        <ServiceRegistration />
      </ApplicationProvider>
    );

    expect(screen.getByTestId('service-value')).toHaveTextContent('test');
  });

  it('returns undefined for unregistered services', () => {
    const UnregisteredServiceTest: React.FC = () => {
      const { getService } = useApplication();
      const service = getService('nonExistentService');

      return <div data-testid="result">{service ? 'found' : 'undefined'}</div>;
    };

    render(
      <ApplicationProvider>
        <UnregisteredServiceTest />
      </ApplicationProvider>
    );

    expect(screen.getByTestId('result')).toHaveTextContent('undefined');
  });
});
