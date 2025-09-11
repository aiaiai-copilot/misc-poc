import { ApplicationContextProvider } from './contexts/ApplicationContext'
import IntegratedIndex from './pages/IntegratedIndex'
import { Toaster } from 'sonner'
import './App.css'

function App(): JSX.Element {
  return (
    <ApplicationContextProvider>
      <IntegratedIndex />
      <Toaster 
        position="bottom-left" 
        toastOptions={{
          style: {
            background: '#374151',
            color: '#ffffff',
            border: '1px solid #4b5563'
          }
        }}
      />
    </ApplicationContextProvider>
  )
}

export default App