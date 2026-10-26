import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces/wght.css';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/manrope/wght.css';
import './styles.css';
import './styles/landing.css';
import './styles/admin.css';
import './styles/builder.css';
import './styles/student.css';
import './styles/ai-review.css';
import './styles/auth.css';
import './styles/profile.css';
import './styles/directory.css';
import './styles/pwa.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.warn('SmartQuiz offline shell was not registered.', error);
    });
  });
}
