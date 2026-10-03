// Which page shows for which URL. Pages for later phases show a "coming soon" card for now.
import { createBrowserRouter } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { ComingSoon } from './components/ComingSoon';
import { NotFoundPage } from './components/NotFoundPage';
import { HomePage } from './features/home/HomePage';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'documents', element: <ComingSoon title="Study guides" phase={3} /> },
      { path: 'notes', element: <ComingSoon title="Notes" phase={6} /> },
      { path: 'decks', element: <ComingSoon title="Flashcards" phase={5} /> },
      { path: 'study', element: <ComingSoon title="Study session" phase={5} /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
