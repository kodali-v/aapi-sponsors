import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import LoginPage from './pages/LoginPage';
import MainPage from './pages/MainPage';
import PublicSouvenir from './pages/PublicSouvenir';
import './index.css';

// Public, no-login Souvenir view: served on the souvenir.* subdomain or the /souvenir path
const host = window.location.hostname;
const path = window.location.pathname.replace(/\/+$/, '');
const isPublicSouvenir = host.startsWith('souvenir.') || path === '/souvenir';

const root = ReactDOM.createRoot(document.getElementById('root'));

if (isPublicSouvenir) {
  root.render(
    <React.StrictMode>
      <PublicSouvenir />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <App>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<MainPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </App>
      </BrowserRouter>
    </React.StrictMode>
  );
}
