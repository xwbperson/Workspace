import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { AppErrorBoundary } from './app/ErrorBoundary.js';
import { PwaUpdatePrompt } from './app/PwaUpdatePrompt.js';
import { router } from './app/router.js';
import { ToastProvider } from './components/ui/ToastProvider.js';
import { queryClient } from './platform/api/client.js';
import { AuthProvider } from './platform/auth/AuthProvider.js';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('缺少应用根节点。');

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <RouterProvider router={router} />
            <PwaUpdatePrompt />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
