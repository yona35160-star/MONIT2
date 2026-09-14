import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import './styles/index.css';
import { setupNativeNotificationHandlers } from './services/firebase-messaging';

export function mountApp(App: React.ComponentType, withPush = true) {
  if (withPush) setupNativeNotificationHandlers();

  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Could not find root element');

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </React.StrictMode>
  );

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
    });
  }
}
