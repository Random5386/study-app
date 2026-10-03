// Entry point: sets up data fetching (TanStack Query) and routing (React Router),
// then renders the app into <div id="root"> in index.html. See docs/13-react-frontend.md.
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import './index.css';
import { queryClient } from './lib/queryClient';
import { router } from './routes';

const root = document.getElementById('root');
if (!root) throw new Error('Missing <div id="root"> in index.html');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
