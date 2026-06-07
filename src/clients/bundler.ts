import { HttpClient, queryString } from '../http.js';
import type { AssetRef, QuoteExactIn } from '../types.js';

export type SwapExactInInput = {
  poolId: string;
  traderVk: string;
  trader?: string;
  inputAsset: AssetRef;
  amountIn: number;
  minAmountOut: number;
  deadlineHeight?: number;
};

export class BundlerClient {
  readonly http: HttpClient;

  constructor(baseUrl: string | undefined, options: { timeoutMs?: number; headers?: Record<string, string> } = {}) {
    this.http = new HttpClient(baseUrl, 'Bundler/Marketplace API', options);
  }

  get baseUrl(): string {
    return this.http.baseUrl;
  }

  health(): Promise<Record<string, unknown>> {
    return this.http.get('/health');
  }

  assets(): Promise<Record<string, unknown>> {
    return this.http.get('/assets');
  }

  pools(): Promise<Record<string, unknown>> {
    return this.http.get('/pools');
  }

  quoteExactIn(input: { poolId: string; inputAsset: AssetRef; amountIn: number }): Promise<QuoteExactIn> {
    return this.http.get(`/quotes/exact-in${queryString({
      pool_id: input.poolId,
      input_sl_id: input.inputAsset.sl_id,
      input_version: input.inputAsset.version,
      input_asset_id: input.inputAsset.asset_id,
      amount_in: input.amountIn
    })}`);
  }

  swapExactIn(input: SwapExactInInput): Promise<Record<string, unknown>> {
    return this.http.post('/swaps/exact-in', {
      pool_id: input.poolId,
      trader_vk: input.traderVk,
      trader: input.trader,
      input_asset: input.inputAsset,
      amount_in: input.amountIn,
      min_amount_out: input.minAmountOut,
      deadline_height: input.deadlineHeight
    });
  }

  wrapBundle(input: { bundleId: string; childPayloadHex: string[] }): Promise<Record<string, unknown>> {
    return this.http.post('/bundles/wrap', {
      bundle_id: input.bundleId,
      child_payload_hex: input.childPayloadHex
    });
  }
}
