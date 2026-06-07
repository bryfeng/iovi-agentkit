import { BaseLayerClient } from './clients/base-layer.js';
import { BundlerClient } from './clients/bundler.js';
import { PaymentClient } from './clients/payment.js';
import { VerifierClient } from './clients/verifier.js';
import { DEFAULT_PUBLIC_SERVICES } from './defaults.js';
import { MissingServiceUrlError, normalizeBaseUrl } from './http.js';
import type { AgentKitOptions, ServiceUrls } from './types.js';
import { MarketplaceWorkflow, PaymentWorkflow } from './workflows/index.js';

export * from './clients/base-layer.js';
export * from './clients/bundler.js';
export * from './clients/payment.js';
export * from './clients/verifier.js';
export * from './defaults.js';
export * from './http.js';
export * from './receipts.js';
export * from './types.js';
export * from './workflows/index.js';

export class IoviAgentKit {
  readonly options: AgentKitOptions;
  readonly services: ServiceUrls;
  #payment?: PaymentClient;
  #verifier?: VerifierClient;
  #baseLayer?: BaseLayerClient;
  #bundler?: BundlerClient;
  #paymentWorkflow?: PaymentWorkflow;
  #marketplaceWorkflow?: MarketplaceWorkflow;

  constructor(options: AgentKitOptions = {}) {
    this.options = options;
    const defaults: ServiceUrls = options.profile === 'sandbox' ? DEFAULT_PUBLIC_SERVICES : {};
    this.services = {
      paymentSlUrl: normalizeBaseUrl(options.paymentSlUrl ?? defaults.paymentSlUrl),
      verifierUrl: normalizeBaseUrl(options.verifierUrl ?? defaults.verifierUrl),
      bundlerUrl: normalizeBaseUrl(options.bundlerUrl ?? defaults.bundlerUrl),
      baseLayerUrl: normalizeBaseUrl(options.baseLayerUrl ?? defaults.baseLayerUrl)
    };
  }

  static sandbox(options: Omit<AgentKitOptions, 'profile'> = {}): IoviAgentKit {
    return new IoviAgentKit({ ...options, profile: 'sandbox' });
  }

  get payment(): PaymentClient {
    this.#payment ??= new PaymentClient(
      requireUrl(this.services.paymentSlUrl, 'Payment SL'),
      clientOptions(this.options)
    );
    return this.#payment;
  }

  get verifier(): VerifierClient {
    this.#verifier ??= new VerifierClient(
      requireUrl(this.services.verifierUrl, 'Generic Verifier'),
      clientOptions(this.options)
    );
    return this.#verifier;
  }

  get baseLayer(): BaseLayerClient {
    this.#baseLayer ??= new BaseLayerClient(
      requireUrl(this.services.baseLayerUrl, 'Base-Layer API'),
      clientOptions(this.options)
    );
    return this.#baseLayer;
  }

  get bundler(): BundlerClient {
    this.#bundler ??= new BundlerClient(
      requireUrl(this.services.bundlerUrl, 'Bundler/Marketplace API'),
      clientOptions(this.options)
    );
    return this.#bundler;
  }

  get paymentWorkflow(): PaymentWorkflow {
    this.#paymentWorkflow ??= new PaymentWorkflow(this.payment, this.services);
    return this.#paymentWorkflow;
  }

  get marketplaceWorkflow(): MarketplaceWorkflow {
    this.#marketplaceWorkflow ??= new MarketplaceWorkflow(this.bundler, this.services);
    return this.#marketplaceWorkflow;
  }
}

function clientOptions(options: AgentKitOptions): { timeoutMs?: number; headers?: Record<string, string> } {
  return {
    timeoutMs: options.timeoutMs,
    headers: options.headers
  };
}

function requireUrl(value: string | undefined, serviceName: string): string {
  if (!value) throw new MissingServiceUrlError(serviceName);
  return value;
}
