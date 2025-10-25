import { AppProviders } from '@/components/app-providers.tsx'
import { AppLayout } from '@/components/app-layout.tsx'
import { AppRoutes } from '@/app-routes.tsx'
import { NotificationProvider } from '@/components/notification-container.tsx'

const links: { label: string; path: string }[] = [
  //

  { label: 'Home', path: '/' },
  { label: 'Sign', path: '/view' },
]

export function App() {
  return (
    <AppProviders>
      <NotificationProvider>
        <AppLayout links={links}>
          <AppRoutes />
        </AppLayout>
      </NotificationProvider>
    </AppProviders>
  )
}
