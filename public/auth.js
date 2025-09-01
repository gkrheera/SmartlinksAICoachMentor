// This script runs inside the Teams-managed authentication popup.

// 1. Initialize a temporary MSAL instance configured to NOT handle the redirect automatically.
// This is the key change: it ensures the hash is available to be passed back to the main app.
const msalInstance = new msal.PublicClientApplication({
    auth: {
        // You MUST provide clientId here for the instance to be created.
        clientId: "ad2de1bb-a645-4140-996c-45a61436c5ba" // Your actual Client ID
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false,
    },
});
msalInstance.handleRedirectPromise().catch((error) => {
    console.info("MSAL popup redirect handler initialized.");
});


// 2. Initialize the Teams SDK
microsoftTeams.app.initialize().then(() => {
  console.log("Auth-popup initialized. Checking for auth hash...");
  
  // 3. Check for the authentication hash in the URL.
  if (window.location.hash) {
    // If a hash is found, pass it back to the main app window.
    microsoftTeams.authentication.notifySuccess(window.location.hash);
  } else {
    // If no hash, something went wrong.
    microsoftTeams.authentication.notifyFailure("No authentication hash found in the redirect URL.");
  }
}).catch((error) => {
    console.error("Failed to initialize Teams SDK in auth popup:", error);
    microsoftTeams.authentication.notifyFailure("SDK initialization failed.");
});
