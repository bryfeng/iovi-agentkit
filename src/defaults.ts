export const DEFAULT_PUBLIC_SERVICES = {
  paymentSlUrl: 'https://eon-payment-sl-demo-production.up.railway.app',
  verifierUrl: 'https://verifier-production-7dc3.up.railway.app',
  bundlerUrl: 'https://bundler-production-b637.up.railway.app',
  baseLayerUrl: 'https://iovi-api-production.up.railway.app'
} as const;

export const DEFAULT_IDS = {
  paymentSlId: '00010001',
  stockSlId: '00020001',
  usdSlId: '00020002',
  settlementSlId: '00030001',
  ammSlId: '00040001',
  version: '0001'
} as const;

export type ServiceProfile = 'sandbox' | 'custom';
