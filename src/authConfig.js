import { LogLevel } from '@azure/msal-browser';

const clientId = "ad2de1bb-a645-4140-996c-45a61436c5ba";
// IMPORTANT: Ensure your Tenant ID is correctly set in your environment variables.
const tenantId = process.env.REACT_APP_AZURE_TENANT_ID;

if (!clientId || !tenantId) {
  throw new Error("Azure AD configuration is missing. Please check your environment variables.");
}

export const msalConfig = {
  auth: {
    clientId: clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: `${window.location.origin}/auth.html`, 
    postLogoutRedirectUri: "/",
    // This MUST be false for the Teams popup flow to work correctly.
    // It prevents MSAL from trying to navigate the main window from the popup.
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false, 
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
          default:
            return;
        }
      },
    },
  },
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'email']
};

export const apiRequest = {
    scopes: [`api://${clientId}/access_as_user`]
};

