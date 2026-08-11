import { createBrowserRouter } from 'react-router-dom';
import { featureRoutes } from './feature-routes.js';
import { ProtectedShell } from './ProtectedShell.js';
import { FeaturesPage } from './pages/FeaturesPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { NotificationsPage } from './pages/NotificationsPage.js';
import { OverviewPage } from './pages/OverviewPage.js';
import { SearchPage } from './pages/SearchPage.js';
import { SettingsPage } from './pages/SettingsPage.js';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <ProtectedShell />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'features', element: <FeaturesPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      ...featureRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
