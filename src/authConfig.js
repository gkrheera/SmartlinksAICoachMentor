import { LogLevel } from '@azure/msal-browser';

const clientId = "ad2de1bb-a645-4140-996c-45a61436c5ba";
const tenantId = process.env.REACT_APP_AZURE_TENANT_ID;

if (!clientId || !tenantId) {
  throw new Error("Azure AD configuration is missing. Please check your environment variables.");
}

export const msalConfig = {
  auth: {
    clientId: clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
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
             // console.info(message); // De-clutter console
            return;
          case LogLevel.Verbose:
             // console.debug(message); // De-clutter console
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
  // Nonce will be added dynamically in the App.jsx component
};

export const apiRequest = {
    scopes: [`api://${clientId}/access_as_user`]
};

