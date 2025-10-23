import { useRoutes } from 'react-router'
import { lazy } from 'react'
import AccountView from '@/components/account-view.tsx'

const Dropzone = lazy(() => import('@/components/dropzone'))
const AccountDetailFeature = lazy(() => import('@/features/account/account-feature-detail.tsx'))
const AccountIndexFeature = lazy(() => import('@/features/account/account-feature-index.tsx'))

export function AppRoutes() {
  return useRoutes([
    { index: true, element: <Dropzone />},
    {
      path: 'view',
      element: <AccountView/>
    },
    {
      path: 'account',
      children: [
        { index: true, element: <AccountIndexFeature /> },
        { path: ':address', element: <AccountDetailFeature /> },
      ],
    },
  ])
}
