/** Phần App Check giả lập — test không cần gọi reCAPTCHA thật. */
export class ReCaptchaV3Provider {
  constructor(siteKey) {
    this.siteKey = siteKey;
  }
}

export function initializeAppCheck() {
  return {};
}
