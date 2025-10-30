import { useRoutes } from 'react-router'
import { lazy } from 'react'

const LandingPage = lazy(() => import('@/components/landing-page'))
const Dropzone = lazy(() => import('@/components/dropzone'))
const SignTx = lazy(() => import('@/components/sign-tx.tsx'))
const VerificationInput = lazy(() => import('@/components/verification/verification-input'))
const VerificationPage = lazy(() => import('@/components/verification'))

export function AppRoutes() {
  return useRoutes([
    { index: true, element: <LandingPage />},
    {
      path: 'stamp',
      element: <Dropzone />
    },
    {
      path: 'sign',
      children: [
        {index: true, element: <SignTx/>}
      ]
    },
    {
      path: 'verify',
      element: <VerificationInput />
    },
    {
      path: 'verify/:signature',
      element: <VerificationPage />
    },
  ])
}
