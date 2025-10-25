import { useWalletUi } from '@wallet-ui/react'
import { Button } from '@/components/ui/button'

export function ClusterDropdown() {
  const { cluster } = useWalletUi()

  return (
    <Button variant="outline" className="cursor-default pointer-events-none">
      {cluster.label}
    </Button>
  )
}
