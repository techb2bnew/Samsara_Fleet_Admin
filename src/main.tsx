import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './features/auth'
import { NotificationsProvider } from './features/notifications'
import { FleetDataProvider } from './features/fleet-data'
import { ToastProvider } from './components/ui'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <FleetDataProvider>
            <NotificationsProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </NotificationsProvider>
          </FleetDataProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
