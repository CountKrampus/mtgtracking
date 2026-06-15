import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import UserProfile from './components/UserProfile';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Check if the current URL is a user profile page (/u/:username)
const profileMatch = window.location.pathname.match(/^\/u\/([a-zA-Z0-9_-]+)\/?$/);

if (profileMatch) {
  const username = profileMatch[1];
  root.render(
    <React.StrictMode>
      <UserProfile username={username} />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
