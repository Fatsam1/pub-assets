// Auto-configured by setup
// Token is stored in chrome.storage.local — this file just bootstraps first-run
const PRIV8_DEFAULT_SERVER = 'https://app.privatehash.online';

// On extension install, pre-set the token so user doesn't need to enter it manually
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Pre-configure with the user's token
    await chrome.storage.local.set({
      authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjE1LCJlbWFpbCI6ImZhdGh5bmFzc2FyMTQ3QGdtYWlsLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzg5OTYzMDQyLCJleHAiOjE4MjE0OTkwNDJ9.AHfP2QE72pceSz_qTl1cyD65tJfpssJowsf5xuTrPyY',
      serverUrl: PRIV8_DEFAULT_SERVER,
    });
  }
});
