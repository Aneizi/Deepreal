import { useRoutes } from 'react-router'
import { lazy } from 'react'

const Dropzone = lazy(() => import('@/components/dropzone'))
const SignTx = lazy(() => import('@/components/sign-tx.tsx'))
const VerificationPage = lazy(() => import('@/components/verification'))

export function AppRoutes() {
  return useRoutes([
    { index: true, element: <Dropzone />},
    {
      path: 'sign',
      children: [
        {index: true, element: <SignTx/>}
      ]
    },
    {
      path: 'verify/:signature',
      element: <VerificationPage />
    },
  ])
}
