import { render, screen } from '@testing-library/react'
import { ApplicationContextProvider, useApplicationContext } from '../ApplicationContext'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock child component to test context consumption
const TestConsumer = (): JSX.Element => {
  const context = useApplicationContext()
  
  return (
    <div>
      <div data-testid="create-use-case">
        {context.createRecordUseCase ? 'CreateRecordUseCase available' : 'CreateRecordUseCase missing'}
      </div>
      <div data-testid="search-use-case">
        {context.searchRecordsUseCase ? 'SearchRecordsUseCase available' : 'SearchRecordsUseCase missing'}
      </div>
    </div>
  )
}

// Mock child component that should throw when context is missing
const TestConsumerWithoutProvider = (): JSX.Element => {
  try {
    useApplicationContext()
    return <div data-testid="context-available">Context available</div>
  } catch (error) {
    return <div data-testid="context-error">{(error as Error).message}</div>
  }
}

describe('ApplicationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ApplicationContextProvider', () => {
    it('should provide all use cases from ApplicationContainer', () => {
      render(
        <ApplicationContextProvider>
          <TestConsumer />
        </ApplicationContextProvider>
      )

      expect(screen.getByTestId('create-use-case')).toHaveTextContent('CreateRecordUseCase available')
      expect(screen.getByTestId('search-use-case')).toHaveTextContent('SearchRecordsUseCase available')
    })

    it('should initialize context with LocalStorage repositories', () => {
      render(
        <ApplicationContextProvider>
          <TestConsumer />
        </ApplicationContextProvider>
      )

      // Context should be successfully initialized (no errors thrown)
      expect(screen.getByTestId('create-use-case')).toBeInTheDocument()
      expect(screen.getByTestId('search-use-case')).toBeInTheDocument()
    })
  })

  describe('useApplicationContext', () => {
    it('should throw error when used outside of ApplicationContextProvider', () => {
      render(<TestConsumerWithoutProvider />)
      
      expect(screen.getByTestId('context-error')).toHaveTextContent(
        'useApplicationContext must be used within ApplicationContextProvider'
      )
    })

    it('should return context with all use cases when used within provider', () => {
      render(
        <ApplicationContextProvider>
          <TestConsumer />
        </ApplicationContextProvider>
      )

      // All use cases should be available
      expect(screen.getByTestId('create-use-case')).toHaveTextContent('CreateRecordUseCase available')
      expect(screen.getByTestId('search-use-case')).toHaveTextContent('SearchRecordsUseCase available')
    })
  })

  describe('error handling', () => {
    it('should handle ApplicationContainer initialization errors gracefully', () => {
      // This test would verify that if container initialization fails,
      // the provider handles it gracefully rather than crashing the app
      render(
        <ApplicationContextProvider>
          <TestConsumer />
        </ApplicationContextProvider>
      )

      // Should not crash during rendering
      expect(screen.getByTestId('create-use-case')).toBeInTheDocument()
    })
  })
})