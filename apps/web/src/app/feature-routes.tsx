import { CountdownPage } from '../features/countdowns/index.js';

export const featureRoutes = [
  { path: 'features/countdowns', element: <CountdownPage /> },
  { path: 'features/countdowns/:countdownId', element: <CountdownPage /> },
] as const;
