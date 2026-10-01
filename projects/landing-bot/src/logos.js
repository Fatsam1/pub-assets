// Brand SVG logos — inline strings keyed by tpl.key (lowercase brand slug)
export const LOGOS = {
  facebook: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="56" height="56"><path fill="#1877F2" d="M36 18C36 8.059 27.941 0 18 0S0 8.059 0 18c0 8.987 6.585 16.436 15.188 17.797V23.203h-4.57V18h4.57v-3.967c0-4.511 2.688-7.004 6.8-7.004 1.97 0 4.03.352 4.03.352v4.43h-2.27c-2.237 0-2.934 1.388-2.934 2.811V18h4.994l-.799 5.203h-4.195v12.594C29.415 34.436 36 26.987 36 18z"/><path fill="#fff" d="M25.009 23.203L25.808 18h-4.994v-3.378c0-1.423.697-2.811 2.934-2.811h2.27v-4.43s-2.06-.352-4.03-.352c-4.112 0-6.8 2.493-6.8 7.004V18h-4.57v5.203h4.57v12.594a18.176 18.176 0 005.625 0V23.203h4.195z"/></svg>`,

  instagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><defs><radialGradient id="ig1" cx="30%" cy="107%" r="150%"><stop offset="0%" stop-color="#fdf497"/><stop offset="5%" stop-color="#fdf497"/><stop offset="45%" stop-color="#fd5949"/><stop offset="60%" stop-color="#d6249f"/><stop offset="90%" stop-color="#285AEB"/></radialGradient></defs><rect width="56" height="56" rx="13" fill="url(#ig1)"/><rect x="8" y="8" width="40" height="40" rx="10" fill="none" stroke="#fff" stroke-width="3.5"/><circle cx="28" cy="28" r="9" fill="none" stroke="#fff" stroke-width="3.5"/><circle cx="39" cy="17" r="2.5" fill="#fff"/></svg>`,

  twitter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#000"/><path fill="#fff" d="M32.1 25.1L42.5 13h-2.5L31 23.5 24 13H14l11 16-11 13.5h2.5l9.6-11.2L34 42.5h10L32.1 25.1zm-3.4 3.9l-1.1-1.6L17.2 14.8h3.8L30 24.9l1.1 1.6 9.3 13.3h-3.8L28.7 29z"/></svg>`,

  google: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="56" height="56"><path fill="#EA4335" d="M24 9.5c3.2 0 5.8 1.1 8 2.9l5.9-5.9C34.4 3.5 29.5 1.5 24 1.5 15.1 1.5 7.5 6.8 4.1 14.4l6.9 5.4C12.7 13.5 17.9 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.1 5.2-4.5 6.8l6.9 5.4C42.9 37.2 46.1 31.3 46.1 24.5z"/><path fill="#FBBC05" d="M11 28.2c-.7-2-.7-4.3 0-6.3L4.1 16.5C1.4 21.5 1.4 27.7 4.1 32.6L11 28.2z"/><path fill="#34A853" d="M24 46.5c5.5 0 10.4-1.8 13.9-4.9l-6.9-5.4c-1.9 1.3-4.3 2-7 2-6.1 0-11.3-4-13-9.5l-6.9 5.4C7.5 41.2 15.1 46.5 24 46.5z"/><path fill="none" d="M0 0h48v48H0z"/></svg>`,

  gmail: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="56" height="56"><path fill="#EA4335" d="M6 40h6V21.1L2 13.4V36c0 2.2 1.8 4 4 4z"/><path fill="#34A853" d="M36 40h6c2.2 0 4-1.8 4-4V13.4l-10 7.7V40z"/><path fill="#FBBC05" d="M36 10H12L2 2v13.4l22 16.9 22-16.9V2l-10 8z"/><path fill="#4285F4" d="M2 2l22 16.9L46 2v11.4L24 30.3 2 13.4V2z"/></svg>`,

  apple: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#000"/><path fill="#fff" d="M37.5 29.8c0-4.5 3.7-6.7 3.9-6.8-2.1-3.1-5.4-3.5-6.6-3.6-2.8-.3-5.4 1.6-6.8 1.6-1.4 0-3.6-1.6-5.9-1.5-3 .04-5.8 1.8-7.4 4.5-3.2 5.5-.8 13.7 2.3 18.2 1.5 2.2 3.4 4.7 5.8 4.6 2.3-.1 3.2-1.5 6-1.5 2.7 0 3.5 1.5 6 1.4 2.5 0 4.1-2.3 5.6-4.5 1.8-2.6 2.5-5.1 2.6-5.2-.1-.1-5.5-2.1-5.5-7.2zM33 17.1c1.3-1.5 2.1-3.6 1.9-5.7-1.8.1-4 1.2-5.3 2.7-1.2 1.3-2.2 3.5-1.9 5.5 2 .2 4-1 5.3-2.5z"/></svg>`,

  microsoft: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect x="4" y="4" width="22" height="22" fill="#F25022"/><rect x="30" y="4" width="22" height="22" fill="#7FBA00"/><rect x="4" y="30" width="22" height="22" fill="#00A4EF"/><rect x="30" y="30" width="22" height="22" fill="#FFB900"/></svg>`,

  amazon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><text x="28" y="36" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="28" font-weight="900" fill="#FF9900">a</text><path fill="#FF9900" d="M14 40c5 3 10.5 5 16 5 5 0 10-.8 14.5-2.5-1-.6-2.5-.4-3.5.2-3.5 1.5-7 2.3-11 2.3-5.5 0-10.8-1.5-15-4.3-.5-.3-1.3-.2-1 .3z"/><path fill="#FF9900" d="M41 38c.8-.4 2.3-1 3.2-1.3l-.2-.4c-.8.1-2.5.5-3.8 1.4l.8.3z"/></svg>`,

  netflix: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><path fill="#E50914" d="M12 8v40l8-2V26l8 22 8-22v20l8 2V8h-8L28 28 20 8z"/></svg>`,

  paypal: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><path fill="#003087" d="M20 8h12c6 0 10 3 9 9-1 7-6 10-12 10h-3l-2 13H16L20 8z"/><path fill="#009CDE" d="M23 10h11c5 0 9 2.5 8.5 8-0.5 6.5-5.5 9.5-11 9.5h-3l-1.5 10H19.5L23 10z"/><path fill="#012169" d="M28 27.5h3c4.5 0 8-2.5 8.5-7.5 0.5-4-2-6-6.5-6H22l-3.5 23h5L26 27.5z"/></svg>`,

  binance: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#181A20"/><path fill="#FCD535" d="M28 12l4.5 4.5-4.5 4.5-4.5-4.5L28 12zm-12 12l4.5 4.5L16 33l-4.5-4.5L16 24zm24 0l4.5 4.5-4.5 4.5-4.5-4.5L40 24zm-12 0l4.5 4.5L28 33l-4.5-4.5L28 24zm0 8l4.5 4.5L28 41l-4.5-4.5L28 32z"/></svg>`,

  metamask: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#1C1F22"/><path fill="#E2761B" d="M44 10L30 21l2.5-6L44 10z"/><path fill="#E4761B" d="M12 10l13.8 11.3-2.3-6.3L12 10z"/><path fill="#D7C1B3" d="M39.3 35.5l-3.7 5.7 8 2.2 2.3-7.7-6.6-.2z"/><path fill="#233447" d="M9.2 35.7l2.2 7.7 7.9-2.2-3.7-5.7-6.4.2z"/><path fill="#CD6116" d="M18.8 26.1l-2.1 3.2 7.6.3-.3-8.2-5.2 4.7z"/><path fill="#E4751F" d="M37.2 26.1l-5.3-4.8-.1 8.3 7.5-.3-2.1-3.2z"/><path fill="#F6851B" d="M19.3 41.2l4.6-2.2-4-3.1-.6 5.3z"/><path fill="#E4751F" d="M32.1 39l4.6 2.2-.5-5.3-4.1 3.1z"/><path fill="#F6851B" d="M36.7 41.2l-4.6-2.2.4 3.3-.1 1.7 4.3-2.8z"/><path fill="#E4761B" d="M19.3 41.2l4.2 2.8-.1-1.7.4-3.3-4.5 2.2z"/></svg>`,

  coinbase: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="28" fill="#0052FF"/><path fill="#fff" d="M28 12c-8.8 0-16 7.2-16 16s7.2 16 16 16 16-7.2 16-16-7.2-16-16-16zm0 6a10 10 0 110 20 10 10 0 010-20zm5 7h-10v6h10v-6z"/></svg>`,

  ledger: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#000"/><path fill="#fff" d="M10 10h14v22H10V10zm20 0h16v10H30V10zM10 36h16v10H10V36zm20 14V36h16v14H30z"/></svg>`,

  trezor: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#1E2026"/><rect x="16" y="12" width="24" height="18" rx="4" fill="none" stroke="#00854D" stroke-width="2.5"/><rect x="22" y="30" width="12" height="16" rx="3" fill="#00854D"/><circle cx="28" cy="38" r="2.5" fill="#fff"/></svg>`,

  trustwallet: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#0500FF"/><path fill="#fff" d="M28 10c-5 4.5-10 6-14 6 0 12 5.5 21 14 26 8.5-5 14-14 14-26-4 0-9-1.5-14-6z"/></svg>`,

  discord: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#5865F2"/><path fill="#fff" d="M38.5 17.5a28 28 0 00-7-2.2l-.3.6c-2.4-.5-4.9-.5-7.4 0l-.3-.6a28.4 28.4 0 00-7 2.2C12 24.5 10.5 31.2 11.2 37.8c3 2.2 5.9 3.5 8.7 4.4.7-.9 1.3-1.9 1.8-3a18 18 0 01-2.9-1.4l.7-.5c5.6 2.6 11.7 2.6 17.3 0l.7.5c-.9.5-1.9 1-2.9 1.4.5 1.1 1.1 2.1 1.8 3 2.8-.9 5.7-2.2 8.7-4.4.8-7.8-1.3-14.5-4.6-20.3zm-17.3 16.2c-1.6 0-3-1.5-3-3.3 0-1.8 1.3-3.3 3-3.3s3 1.5 3 3.3c0 1.8-1.3 3.3-3 3.3zm11 0c-1.6 0-3-1.5-3-3.3 0-1.8 1.3-3.3 3-3.3s3 1.5 3 3.3c0 1.8-1.3 3.3-3 3.3z"/></svg>`,

  linkedin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="10" fill="#0A66C2"/><path fill="#fff" d="M16 22h6v18h-6V22zm3-9.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7zm10 9.5h5.7v2.5h.1c.8-1.5 2.7-3 5.6-3 6 0 7.1 3.9 7.1 9v10.5h-6V32c0-2.2 0-5-3-5s-3.5 2.3-3.5 4.8V40H29V22z"/></svg>`,

  snapchat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#FFFC00"/><path fill="#000" d="M28 10c-5 0-9 4-9 9v1.5c-.5.2-2 .5-3 .8l.5 1.7c1 0 2-.2 2.5-.3 0 .5.1 1 .3 1.4-1.8 1-4.2 2.3-4.2 3.4 0 1 1.3 1.5 2.2 1.5.5 0 1-.1 1.5-.2 1 1.5 3 2.4 5.3 2.8l.8.1c-1 1.5-3 2.2-5.2 2.7-.3.1-.5.3-.4.6.5 2 5 2 7 2.2.5 1 1.5 1.5 2.7 1.5s2.2-.5 2.7-1.5c2-.2 6.5-.2 7-2.2.1-.3-.1-.5-.4-.6-2.2-.5-4.2-1.2-5.2-2.7l.8-.1c2.3-.4 4.3-1.3 5.3-2.8.5.1 1 .2 1.5.2.9 0 2.2-.5 2.2-1.5 0-1.1-2.4-2.4-4.2-3.4.2-.4.3-.9.3-1.4.5.1 1.5.3 2.5.3l.5-1.7c-1-.3-2.5-.6-3-.8V19c0-5-4-9-9-9z"/></svg>`,

  tiktok: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#000"/><path fill="#EE1D52" d="M33.5 13c.8 3 3 5 6 6v4c-2.2-.1-4.3-.9-6-2.3v10c0 5.5-4.5 10-10 10s-10-4.5-10-10 4.5-10 10-10c.7 0 1.3.1 2 .2v4.3c-.6-.2-1.3-.3-2-.3-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6V13h4z"/><path fill="#fff" d="M32 13c.8 3 3 5 6 6v4c-2.2-.1-4.3-.9-6-2.3v10c0 5.5-4.5 10-10 10s-10-4.5-10-10 4.5-10 10-10c.7 0 1.3.1 2 .2v4.3c-.6-.2-1.3-.3-2-.3-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6V13h4z"/></svg>`,

  spotify: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><circle cx="28" cy="28" r="28" fill="#1DB954"/><path fill="#000" d="M39.5 36.2c-.5.8-1.5 1-2.3.6-6.3-3.8-14.2-4.7-23.6-2.6-.9.2-1.7-.4-1.9-1.2-.2-.9.4-1.7 1.2-1.9 10.2-2.3 19-1.3 26 3C39.8 34.6 40 35.5 39.5 36.2zm2.7-6c-.6.9-1.8 1.2-2.7.6-7.2-4.4-18.2-5.7-26.7-3.1-1.1.3-2.2-.3-2.5-1.4-.3-1.1.3-2.2 1.4-2.5 9.8-2.9 22-1.5 30.1 3.6.9.5 1.2 1.8.4 2.8zm.3-6.2c-8.6-5.1-22.8-5.6-31-3.1-1.3.4-2.7-.4-3.1-1.7-.4-1.3.4-2.7 1.7-3.1 9.5-2.9 25.2-2.3 35.1 3.6 1.2.7 1.5 2.2.8 3.3-.7 1.1-2.2 1.5-3.5.9v.1z"/></svg>`,

  steam: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#1B2838"/><circle cx="28" cy="22" r="10" fill="none" stroke="#66C0F4" stroke-width="3"/><circle cx="28" cy="22" r="5" fill="#66C0F4"/><path fill="#66C0F4" d="M12 34l8 4 3-6-7-3-4 5z"/></svg>`,

  uber: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#000"/><text x="28" y="36" text-anchor="middle" font-family="Arial,sans-serif" font-size="26" font-weight="900" fill="#fff">U</text></svg>`,

  airbnb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#FF5A5F"/><path fill="#fff" d="M28 10c-2 0-3.5 1-4.5 2.5L12 32.5c-.5 1-.5 2.5 0 3.5.5 1.5 2 2.5 3.5 2.5 1.5 0 2.5-.5 3.5-1.5l.5-.5c1 2.5 3 4 5.5 4s4.5-1.5 5.5-4l.5.5c1 1 2 1.5 3.5 1.5 1.5 0 3-1 3.5-2.5.5-1 .5-2.5 0-3.5L32.5 12.5C31.5 11 30 10 28 10zm0 3c1 0 2 .5 2.5 1.5l9 17.5c.2.5.2 1 0 1.5-.3.5-.8.8-1.5.8-.5 0-1-.2-1.5-.5-2-2-3.5-4.5-3.5-7.3 0-2-1-3.5-5-3.5s-5 1.5-5 3.5c0 2.8-1.5 5.3-3.5 7.3-.5.3-1 .5-1.5.5-.7 0-1.2-.3-1.5-.8-.2-.5-.2-1 0-1.5l9-17.5c.5-1 1.5-1.5 2.5-1.5zm0 13c1 0 2 .5 2.5 1.5.5.8.5 1.7 0 2.5-.5 1-1.5 1.5-2.5 1.5s-2-.5-2.5-1.5c-.5-.8-.5-1.7 0-2.5.5-1 1.5-1.5 2.5-1.5z"/></svg>`,

  dropbox: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><path fill="#0061FF" d="M28 10l-14 9 14 9 14-9-14-9zm-14 21l14 9 14-9-7-4.5-7 4.5-7-4.5-7 4.5zm14 9l-14-9v3l14 9 14-9v-3l-14 9z"/></svg>`,

  ebay: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><text x="4" y="38" font-family="Arial Black,sans-serif" font-size="22" font-weight="900"><tspan fill="#E53238">e</tspan><tspan fill="#0064D2">B</tspan><tspan fill="#F5AF02">a</tspan><tspan fill="#86B817">y</tspan></text></svg>`,

  yahoo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#6001D2"/><text x="28" y="36" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="20" font-weight="900" fill="#fff">yahoo!</text></svg>`,

  reddit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><circle cx="28" cy="28" r="28" fill="#FF4500"/><circle cx="28" cy="30" r="12" fill="#fff"/><path fill="#FF4500" d="M36 28a8 8 0 10-16 0"/><circle cx="24" cy="30" r="2" fill="#FF4500"/><circle cx="32" cy="30" r="2" fill="#FF4500"/><path fill="#FF4500" d="M24 35c2 1.5 6 1.5 8 0"/><circle cx="40" cy="22" r="5" fill="#fff"/><path fill="#C6C6C6" d="M33 16l2-6 7 2-2 5-7-1z"/></svg>`,

  github: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#24292E"/><path fill="#fff" d="M28 10C18.1 10 10 18.1 10 28c0 8 5.2 14.8 12.4 17.2.9.2 1.2-.4 1.2-.8v-3c-5 1.1-6-2.4-6-2.4-.8-2.1-2-2.7-2-2.7-1.6-1.1.1-1.1.1-1.1 1.8.1 2.7 1.8 2.7 1.8 1.6 2.7 4.1 1.9 5.1 1.5.2-1.1.6-1.9 1.1-2.3-3.9-.5-8-2-8-8.7 0-1.9.7-3.5 1.8-4.7-.2-.5-.8-2.2.2-4.6 0 0 1.5-.5 4.8 1.8 1.4-.4 2.9-.6 4.4-.6s3 .2 4.4.6c3.3-2.3 4.8-1.8 4.8-1.8 1 2.4.4 4.1.2 4.6 1.1 1.2 1.8 2.8 1.8 4.7 0 6.7-4.1 8.2-8 8.7.6.5 1.2 1.6 1.2 3.2v4.8c0 .4.3 1 1.2.8C40.8 42.8 46 36 46 28c0-9.9-8.1-18-18-18z"/></svg>`,

  zoom: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#2D8CFF"/><path fill="#fff" d="M10 20h26v16H10V20zm28 3l8-5v14l-8-5V23z"/></svg>`,
};

// Aliases for palKey variants that differ from logo keys
LOGOS.twitterx = LOGOS.twitter;
LOGOS.googlegmail = LOGOS.gmail;
LOGOS.netflixvideo = LOGOS.netflix;
LOGOS.netflixoriginal = LOGOS.netflix;
LOGOS.googledrive = LOGOS.google;
LOGOS.googleplay = LOGOS.google;
LOGOS.microsoftoutlook = LOGOS.microsoft;
LOGOS.microsoftoffice = LOGOS.microsoft;
LOGOS.microsoftteams = LOGOS.microsoft;
LOGOS.amazonprime = LOGOS.amazon;
LOGOS.amazonaws = LOGOS.amazon;
LOGOS.trustwallet = LOGOS.trustwallet || LOGOS.metamask;
// government/airlines — letter fallback is fine, but add simple ones
LOGOS.irs = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#003366"/><text x="28" y="38" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="900" fill="#fff">IRS</text></svg>`;
LOGOS.emirates = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#C8102E"/><text x="28" y="36" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="700" fill="#fff">EMIRATES</text></svg>`;
LOGOS.unitedairlines = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#002244"/><text x="28" y="34" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="#fff">UNITED</text></svg>`;
LOGOS.americanairlines = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56"><rect width="56" height="56" rx="13" fill="#0078D2"/><text x="28" y="34" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="#fff">AMERICAN</text></svg>`;

// Returns the logo SVG for a brand key, or a fallback letter box
export function getLogo(tplKey, brandName, accentColor) {
  if (LOGOS[tplKey]) return LOGOS[tplKey];
  const letter = (brandName || '?').charAt(0).toUpperCase();
  return `<div style="width:56px;height:56px;border-radius:16px;background:${accentColor || '#5b8cff'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.7rem;margin:0 auto">${letter}</div>`;
}
