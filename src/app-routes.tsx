import { useRoutes } from 'react-router'
import { lazy } from 'react'

const Dropzone = lazy(() => import('@/components/dropzone.tsx'))
const AccountView = lazy(() => import('@/components/account-view.tsx'))
const AccountDetailFeature = lazy(() => import('@/features/account/account-feature-detail.tsx'))
const AccountIndexFeature = lazy(() => import('@/features/account/account-feature-index.tsx'))

export function AppRoutes() {
  return useRoutes([
    { index: true, element: <Dropzone />},
    {
      path: 'view',
      children: [
        {index: true, element: <AccountView/>}
      ]
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
