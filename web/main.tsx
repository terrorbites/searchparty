import React from 'react';
import { createRoot } from 'react-dom/client';
import Home from '../app/page';
import LegalPage from '../app/components/LegalPage';
import type { LegalPageKey } from '../app/lib/legal-content';
import '../app/globals.css';
import '../app/theme.css';
import '../app/room-theme.css';

const route = window.location.pathname.replace(/\/+$/, '').toLowerCase();
const legalRoute = ['/privacy', '/cookies', '/terms', '/safety'].includes(route) ? route.slice(1) as LegalPageKey : null;

// Legal documents are separate views: Home never mounts, so private session
// data, preferences and map tiles are not loaded merely to read a policy.
createRoot(document.getElementById('root')!).render(<React.StrictMode>{legalRoute ? <LegalPage pageKey={legalRoute}/> : <Home/>}</React.StrictMode>);
