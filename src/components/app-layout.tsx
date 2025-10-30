import React from 'react'
import { ClusterUiChecker } from '@/features/cluster/ui/cluster-ui-checker'
import { ThemeProvider } from './theme-provider'
import { Toaster } from './ui/sonner'
import { AppHeader } from './app-header'
import { AppFooter } from './app-footer'
import { useLocation } from 'react-router'

export function AppLayout({
  children,
  links,
}: {
  children: React.ReactNode
  links: { label: string; path: string }[]
}) {
  const location = useLocation()
  const isLandingPage = location.pathname === '/'

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <div className="flex flex-col min-h-screen">
        {!isLandingPage && <AppHeader links={links} />}
        <main className={`flex-grow ${!isLandingPage ? 'container mx-auto p-4' : ''}`}>
          <ClusterUiChecker>
            {children}
          </ClusterUiChecker>
        </main>
        {!isLandingPage && <AppFooter />}
      </div>
      <Toaster closeButton />
    </ThemeProvider>
  )
}
