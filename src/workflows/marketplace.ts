import type { BundlerClient } from '../clients/bundler.js';
import { createReceipt, updateReceipt, type AgentTaskReceipt } from '../receipts.js';
import type { AssetRef, CustodyMode, JsonValue, MarketAssetRecord } from '../types.js';

export type MarketplaceWorkflowServices = {
  bundlerUrl?: string;
  verifierUrl?: string;
  baseLayerUrl?: string;
};

export class MarketplaceWorkflow {
  readonly bundler: BundlerClient;
  readonly services: MarketplaceWorkflowServices;

  constructor(bundler: BundlerClient, services: MarketplaceWorkflowServices) {
    this.bundler = bundler;
    this.services = services;
  }

  async discoverAssets(input: {
    capability?: string;
    custodyMode?: CustodyMode;
  } = {}): Promise<AgentTaskReceipt> {
    const receipt = createReceipt<Record<string, unknown>>({
      task: 'marketplace.assets',
      status: 'pending',
      custodyMode: input.custodyMode ?? 'watch-only',
      verificationMode: 'none',
      services: this.services,
      details: {
        capability: input.capability
      }
    });

    const response = await this.bundler.assets();
    const assets = input.capability
      ? response.assets.filter((asset: MarketAssetRecord) => asset.capabilities?.includes(input.capability!) === true)
      : response.assets;
    return updateReceipt(receipt, {
      status: 'accepted',
      evidence: {
        assets: assets as unknown as Record<string, JsonValue>[]
      },
      details: {
        count: assets.length,
        assets
      }
    });
  }

  async quoteExactIn(input: {
    poolId: string;
    inputAsset: AssetRef;
    amountIn: number;
    custodyMode?: CustodyMode;
  }): Promise<AgentTaskReceipt> {
    const receipt = createReceipt<Record<string, unknown>>({
      task: 'marketplace.quote_exact_in',
      status: 'pending',
      custodyMode: input.custodyMode ?? 'watch-only',
      verificationMode: 'none',
      services: this.services,
      details: {
        pool_id: input.poolId,
        input_asset: input.inputAsset,
        amount_in: input.amountIn
      }
    });

    const quote = await this.bundler.quoteExactIn(input);
    return updateReceipt(receipt, {
      status: 'accepted',
      evidence: {
        quote: quote as unknown as Record<string, JsonValue>
      },
      details: {
        quote
      }
    });
  }
}
