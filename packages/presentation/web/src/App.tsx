import { ApplicationContextProvider } from './contexts/ApplicationContext'
import IntegratedIndex from './pages/IntegratedIndex'
import { Toaster } from 'sonner'
import './App.css'

function App(): JSX.Element {
  return (
    <ApplicationContextProvider>
      <IntegratedIndex />
      <Toaster richColors position="top-center" />
    </ApplicationContextProvider>
  )
}

export default App