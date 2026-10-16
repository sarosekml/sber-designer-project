import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './styles/design-system.css';
import './styles/demo-app.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
