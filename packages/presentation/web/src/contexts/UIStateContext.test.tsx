import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UIStateProvider, useUIState } from './UIStateContext';

interface TestUIState {
  isLoading: boolean;
  notifications: Array<{
    id: string;
    message: string;
    type: 'info' | 'error' | 'success';
  }>;
  modals: {
    confirmDialog: boolean;
    settings: boolean;
  };
  theme: 'light' | 'dark';
}

const initialState: TestUIState = {
  isLoading: false,
  notifications: [],
  modals: {
    confirmDialog: false,
    settings: false,
  },
  theme: 'light',
};

const TestComponent: React.FC = () => {
  const { state, updateState, resetState, toggleState } =
    useUIState<TestUIState>();

  const handleToggleLoading = (): void => {
    toggleState('isLoading');
  };

  const handleAddNotification = (): void => {
    updateState({
      notifications: [
        ...(state?.notifications || []),
        { id: '1', message: 'Test notification', type: 'info' },
      ],
    });
  };

  const handleToggleTheme = (): void => {
    updateState({
      theme: state?.theme === 'light' ? 'dark' : 'light',
    });
  };

  const handleReset = (): void => {
    resetState();
  };

  return (
    <div>
      <div data-testid="loading-state">
        {state?.isLoading ? 'loading' : 'not loading'}
      </div>
      <div data-testid="notifications-count">
        {state?.notifications?.length || 0}
      </div>
      <div data-testid="theme">{state?.theme || 'no theme'}</div>
      <div data-testid="modal-confirm">
        {state?.modals?.confirmDialog ? 'open' : 'closed'}
      </div>
      <button onClick={handleToggleLoading} data-testid="toggle-loading-btn">
        Toggle Loading
      </button>
      <button
        onClick={handleAddNotification}
        data-testid="add-notification-btn"
      >
        Add Notification
      </button>
      <button onClick={handleToggleTheme} data-testid="toggle-theme-btn">
        Toggle Theme
      </button>
      <button onClick={handleReset} data-testid="reset-btn">
        Reset
      </button>
    </div>
  );
};

describe('UIStateContext', () => {
  it('throws error when used outside provider', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useUIState must be used within UIStateProvider');

    consoleError.mockRestore();
  });

  it('provides initial state and allows updates', () => {
    render(
      <UIStateProvider initialState={initialState}>
        <TestComponent />
      </UIStateProvider>
    );

    expect(screen.getByTestId('loading-state')).toHaveTextContent(
      'not loading'
    );
    expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(screen.getByTestId('modal-confirm')).toHaveTextContent('closed');

    fireEvent.click(screen.getByTestId('add-notification-btn'));
    expect(screen.getByTestId('notifications-count')).toHaveTextContent('1');

    fireEvent.click(screen.getByTestId('toggle-theme-btn'));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('handles toggle functionality', () => {
    render(
      <UIStateProvider initialState={initialState}>
        <TestComponent />
      </UIStateProvider>
    );

    expect(screen.getByTestId('loading-state')).toHaveTextContent(
      'not loading'
    );

    fireEvent.click(screen.getByTestId('toggle-loading-btn'));
    expect(screen.getByTestId('loading-state')).toHaveTextContent('loading');

    fireEvent.click(screen.getByTestId('toggle-loading-btn'));
    expect(screen.getByTestId('loading-state')).toHaveTextContent(
      'not loading'
    );
  });

  it('handles reset functionality', () => {
    render(
      <UIStateProvider initialState={initialState}>
        <TestComponent />
      </UIStateProvider>
    );

    // Make some changes
    fireEvent.click(screen.getByTestId('toggle-loading-btn'));
    fireEvent.click(screen.getByTestId('add-notification-btn'));
    fireEvent.click(screen.getByTestId('toggle-theme-btn'));

    expect(screen.getByTestId('loading-state')).toHaveTextContent('loading');
    expect(screen.getByTestId('notifications-count')).toHaveTextContent('1');
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');

    // Reset
    fireEvent.click(screen.getByTestId('reset-btn'));

    expect(screen.getByTestId('loading-state')).toHaveTextContent(
      'not loading'
    );
    expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });

  it('works without initial state', () => {
    const NoInitialStateTest: React.FC = () => {
      const { state, updateState } = useUIState<TestUIState>();

      const handleSetState = (): void => {
        updateState({ isLoading: true, theme: 'dark' });
      };

      return (
        <div>
          <div data-testid="state-exists">
            {state ? 'has state' : 'no state'}
          </div>
          <div data-testid="loading-state">
            {state?.isLoading ? 'loading' : 'not loading'}
          </div>
          <button onClick={handleSetState} data-testid="set-state-btn">
            Set State
          </button>
        </div>
      );
    };

    render(
      <UIStateProvider>
        <NoInitialStateTest />
      </UIStateProvider>
    );

    expect(screen.getByTestId('state-exists')).toHaveTextContent('no state');
    expect(screen.getByTestId('loading-state')).toHaveTextContent(
      'not loading'
    );

    fireEvent.click(screen.getByTestId('set-state-btn'));

    expect(screen.getByTestId('state-exists')).toHaveTextContent('has state');
    expect(screen.getByTestId('loading-state')).toHaveTextContent('loading');
  });

  it('handles nested state updates correctly', () => {
    const NestedStateTest: React.FC = () => {
      const { state, updateState } = useUIState<TestUIState>();

      const handleOpenModal = (): void => {
        updateState({
          modals: {
            ...state?.modals,
            confirmDialog: true,
          },
        });
      };

      return (
        <div>
          <div data-testid="modal-state">
            {state?.modals?.confirmDialog ? 'modal open' : 'modal closed'}
          </div>
          <div data-testid="other-modal-state">
            {state?.modals?.settings ? 'settings open' : 'settings closed'}
          </div>
          <button onClick={handleOpenModal} data-testid="open-modal-btn">
            Open Modal
          </button>
        </div>
      );
    };

    render(
      <UIStateProvider initialState={initialState}>
        <NestedStateTest />
      </UIStateProvider>
    );

    expect(screen.getByTestId('modal-state')).toHaveTextContent('modal closed');
    expect(screen.getByTestId('other-modal-state')).toHaveTextContent(
      'settings closed'
    );

    fireEvent.click(screen.getByTestId('open-modal-btn'));

    expect(screen.getByTestId('modal-state')).toHaveTextContent('modal open');
    expect(screen.getByTestId('other-modal-state')).toHaveTextContent(
      'settings closed'
    ); // Should remain unchanged
  });
});
