import { LogLevel } from '@azure/msal-browser';

const clientId = process.env.REACT_APP_AZURE_CLIENT_ID;
const tenantId = process.env.REACT_APP_AZURE_TENANT_ID;

if (!clientId || !tenantId) {
  throw new Error("Azure AD configuration is missing. Please check your environment variables.");
}

export const msalConfig = {
  auth: {
    clientId: clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    // This is the default redirect URI for the whole application.
    redirectUri: "https://smartlinksaicoachmentor.netlify.app/",
    postLogoutRedirectUri: "https://smartlinksaicoachmentor.netlify.app/",
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: true,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Info:
            // Suppress verbose info logs
            return;
          case LogLevel.Verbose:
            // Suppress verbose logs
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

// This request is specifically for the pop-up login flow.
// It explicitly tells MSAL where the pop-up will be redirected.
export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
  redirectUri: "https://smartlinksaicoachmentor.netlify.app/auth.html"
};

export const apiRequest = {
    scopes: [`api://${clientId}/access_as_user`]
};

