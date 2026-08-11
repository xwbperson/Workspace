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
] as const;
