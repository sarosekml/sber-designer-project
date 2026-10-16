import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';

import './styles.css';
// 0136 R14 — Monaco is NOT imported here. Importing lib/monaco-setup from the
// entry pulled the whole editor into the first chunk, so Home and Login paid
// for it. The setup module is now a side-effect import of the lazy Code view,
// which evaluates it before the first <Editor> renders. See CodeView.tsx.
import { App } from './App';
import { TooltipProvider } from './components/ui/tooltip';
import { applyStoredAppAccent, applyStoredAppSurface, applyStoredAppTheme } from './lib/theme';
import { queryClient } from './lib/query-client';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

applyStoredAppTheme();
applyStoredAppSurface();
applyStoredAppAccent();

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
