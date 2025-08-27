
export const CallStatus = {
  INITIATED: 'INITIATED',
  ANSWERED: 'ANSWERED',
  COMPLETED: 'COMPLETED'
};

export const IVR_STATES = {
  MAIN_MENU: 'MAIN_MENU',
  SALES: 'SALES',
  SUPPORT: 'SUPPORT'
};

export const AUDIO_URLS = {
  WELCOME: process.env.WELCOME_AUDIO_URL || 'https://example.com/welcome.mp3',
  // SALES: process.env.SALES_AUDIO_URL || 'https://example.com/sales.mp3',
  // SUPPORT: process.env.SUPPORT_AUDIO_URL || 'https://example.com/support.mp3',
  // INVALID: process.env.INVALID_AUDIO_URL || 'https://example.com/invalid.mp3',
  // RETRY: process.env.RETRY_AUDIO_URL || 'https://example.com/retry.mp3'
};