import { ApplicationContextProvider } from './contexts/ApplicationContext'
import IntegratedIndex from './pages/IntegratedIndex'
import { Toaster } from './components/ui/sonner'
import './App.css'

function App(): JSX.Element {
  return (
    <ApplicationContextProvider>
      <IntegratedIndex />
      <Toaster position="bottom-right" />
    </ApplicationContextProvider>
  )
}

export default App