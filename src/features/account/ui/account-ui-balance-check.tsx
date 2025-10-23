import { Address } from 'gill'
import { useEffect } from 'react'
import { useSolana } from '@/components/solana/use-solana'
import { Button } from '@/components/ui/button'
import { useRequestAirdropMutation } from '../data-access/use-request-airdrop-mutation'
import { useGetBalanceQuery } from '../data-access/use-get-balance-query'
import { useNotifications } from '@/components/notification-container'

export function AccountUiBalanceCheck({ address }: { address: Address }) {
  const { cluster } = useSolana()
  const mutation = useRequestAirdropMutation({ address })
  const query = useGetBalanceQuery({ address })
  const { addNotification } = useNotifications()

  useEffect(() => {
    if (!query.isLoading && (query.isError || !query.data?.value)) {
      addNotification({
        title: (
          <>
            You are connected to <strong>{cluster.label}</strong> but your account is not found on this cluster.
          </>
        ),
        action: (
          <Button variant="outline" size="sm" onClick={() => mutation.mutateAsync(1).catch((err) => console.log(err))}>
            Request Airdrop
          </Button>
        ),
        variant: 'warning',
      })
    }
  }, [query.isError, query.isLoading, query.data?.value, cluster.label, addNotification])

  return null
}
