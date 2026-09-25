import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/shell/app-shell'
import { RootRedirect } from '@/pages/root-redirect'
import { FeaturePage } from '@/pages/feature-page'
import { TaskPage } from '@/pages/task-page'
import { DiscoveryPage } from '@/pages/discovery-page'
import { DrawingPage } from '@/pages/drawing-page'
import { ReviewPage } from '@/pages/review-page'
import { PrototypePage } from '@/pages/prototype-page'
import { NotFoundPage } from '@/pages/not-found-page'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <RootRedirect /> },
      { path: 'features/:featureSlug', element: <FeaturePage /> },
      { path: 'features/:featureSlug/:taskSlug', element: <TaskPage /> },
      { path: 'features/:featureSlug/:taskSlug/review', element: <ReviewPage /> },
      { path: 'review', element: <ReviewPage /> },
      { path: 'prototype', element: <PrototypePage /> },
      { path: 'discoveries/:discoverySlug', element: <DiscoveryPage /> },
      { path: 'drawings/:drawingSlug', element: <DrawingPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
