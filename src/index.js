import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App';

// Ensure the Clerk Publishable Key is set in the environment variables.
const publishableKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error("Missing Clerk Publishable Key. Please set REACT_APP_CLERK_PUBLISHABLE_KEY in your .env file.");
}

const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the application with the ClerkProvider at the top level.
// The App component will now use the useClerk hook directly.
root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={publishableKey}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
