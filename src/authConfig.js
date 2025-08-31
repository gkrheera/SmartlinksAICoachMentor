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
    // IMPORTANT: Using the specific Netlify URL for production redirects.
    redirectUri: 'https://smartlinksaicoachmentor.netlify.app/',
    postLogoutRedirectUri: 'https://smartlinksaicoachmentor.netlify.app/',
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
            return;
          case LogLevel.Verbose:
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

