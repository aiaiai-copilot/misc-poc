import { Suspense, lazy } from 'react';
import { ApplicationContextProvider } from './contexts/ApplicationContext';
import { Toaster } from './components/ui/sonner';
import './App.css';

// Lazy load the main page for future route splitting
const IntegratedIndex = lazy(() => import('./pages/IntegratedIndex'));

function App(): JSX.Element {
  return (
    <ApplicationContextProvider>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            Loading...
          </div>
        }
      >
        <IntegratedIndex />
      </Suspense>
      <Toaster position="bottom-right" />
    </ApplicationContextProvider>
  );
}

export default App;
