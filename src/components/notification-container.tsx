import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type Notification = {
  id: string
  title: ReactNode
  action?: ReactNode
  variant?: 'default' | 'destructive' | 'warning'
}

type NotificationContextType = {
  addNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substring(7)
    setNotifications((prev) => [...prev, { ...notification, id }])
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      removeNotification(id)
    }, 3000)
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  return (
    <NotificationContext.Provider value={{ addNotification, removeNotification }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md pointer-events-none">
        {notifications.map((notification) => (
          <div key={notification.id} className="pointer-events-auto animate-in slide-in-from-right">
            <Alert variant={notification.variant || 'warning'} className="bg-background shadow-lg border-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>{notification.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 p-0 hover:bg-transparent"
                  onClick={() => removeNotification(notification.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertTitle>
              {notification.action && (
                <AlertDescription className="flex justify-end mt-2">
                  {notification.action}
                </AlertDescription>
              )}
            </Alert>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}
