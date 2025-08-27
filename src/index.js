import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider, useClerk } from '@clerk/clerk-react';
import './index.css';
import App from './App';

// Ensure the Clerk Publishable Key is set in the environment variables.
const publishableKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error("Missing Clerk Publishable Key. Please set REACT_APP_CLERK_PUBLISHABLE_KEY in your .env file.");
}

const root = ReactDOM.createRoot(document.getElementById('root'));

/**
 * A wrapper component that allows the main App component to access the
 * Clerk instance via props. This is necessary for using headless functions
 * like `clerk.authenticateWithRedirect`.
 */
const AppWrapper = () => {
  const clerk = useClerk();
  return <App clerk={clerk} />;
};

// Render the application with the ClerkProvider at the top level.
root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={publishableKey}>
      <AppWrapper />
    </ClerkProvider>
  </React.StrictMode>
);
