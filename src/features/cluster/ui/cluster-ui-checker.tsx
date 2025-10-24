import { ReactNode, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useSolana } from '@/components/solana/use-solana'
import { useClusterVersion } from '../data-access/use-cluster-version'
import { useNotifications } from '@/components/notification-container'

export function ClusterUiChecker({ children }: { children: ReactNode }) {
  const { cluster } = useSolana()
  const query = useClusterVersion()
  const { addNotification } = useNotifications()

  useEffect(() => {
    if (query.isError || (!query.isLoading && !query.data)) {
      addNotification({
        title: (
          <>
            Error connecting to cluster <span className="font-bold">{cluster.label}</span>.
          </>
        ),
        action: (
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Refresh
          </Button>
        ),
        variant: 'warning',
      })
    }
  }, [query.isError, query.isLoading, query.data, cluster.label, addNotification])

  if (query.isLoading) {
    return null
  }

  if (query.isError || !query.data) {
    return children
  }
  return children
}
