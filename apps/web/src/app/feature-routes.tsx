import { lazy, Suspense } from 'react';
import { PageLoader } from '../components/ui/States.js';

const CountdownPage = lazy(() =>
  import('../features/countdowns/index.js').then((module) => ({ default: module.CountdownPage })),
);
const BookPage = lazy(() =>
  import('../features/books/index.js').then((module) => ({ default: module.BookPage })),
);
const ChapterPage = lazy(() =>
  import('../features/books/index.js').then((module) => ({ default: module.ChapterPage })),
);
const CoursePage = lazy(() =>
  import('../features/courses/index.js').then((module) => ({ default: module.CoursePage })),
);
const GoalPage = lazy(() =>
  import('../features/goals/index.js').then((module) => ({ default: module.GoalPage })),
);
const TaskPage = lazy(() =>
  import('../features/tasks/index.js').then((module) => ({ default: module.TaskPage })),
);
const CalendarPage = lazy(() =>
  import('../features/calendar/index.js').then((module) => ({ default: module.CalendarPage })),
);
const InboxPage = lazy(() =>
  import('../features/inbox/index.js').then((module) => ({ default: module.InboxPage })),
);
const SubscriptionPage = lazy(() =>
  import('../features/subscriptions/index.js').then((module) => ({
    default: module.SubscriptionPage,
  })),
);
const FinancePage = lazy(() =>
  import('../features/finance/index.js').then((module) => ({ default: module.FinancePage })),
);
const LifeCountdownPage = lazy(() =>
  import('../features/life-countdown/index.js').then((module) => ({
    default: module.LifeCountdownPage,
  })),
);

function featurePage(page: React.JSX.Element): React.JSX.Element {
  return <Suspense fallback={<PageLoader label="正在加载功能" />}>{page}</Suspense>;
}

export const featureRoutes = [
  { path: 'features/countdowns', element: featurePage(<CountdownPage />) },
  { path: 'features/countdowns/:countdownId', element: featurePage(<CountdownPage />) },
  { path: 'features/books', element: featurePage(<BookPage />) },
  { path: 'features/books/:bookId', element: featurePage(<BookPage />) },
  {
    path: 'features/books/:bookId/chapters/:chapterId',
    element: featurePage(<ChapterPage />),
  },
  { path: 'features/courses', element: featurePage(<CoursePage />) },
  { path: 'features/courses/:courseId', element: featurePage(<CoursePage />) },
  { path: 'features/goals', element: featurePage(<GoalPage />) },
  { path: 'features/goals/:goalId', element: featurePage(<GoalPage />) },
  { path: 'features/tasks', element: featurePage(<TaskPage />) },
  { path: 'features/tasks/:taskId', element: featurePage(<TaskPage />) },
  { path: 'features/calendar', element: featurePage(<CalendarPage />) },
  { path: 'features/calendar/:entryId', element: featurePage(<CalendarPage />) },
  { path: 'features/inbox', element: featurePage(<InboxPage />) },
  { path: 'features/inbox/:itemId', element: featurePage(<InboxPage />) },
  { path: 'features/subscriptions', element: featurePage(<SubscriptionPage />) },
  { path: 'features/subscriptions/:subscriptionId', element: featurePage(<SubscriptionPage />) },
  { path: 'features/finance', element: featurePage(<FinancePage />) },
  { path: 'features/life-countdown', element: featurePage(<LifeCountdownPage />) },
  { path: 'features/life-countdown/:eventId', element: featurePage(<LifeCountdownPage />) },
] as const;
