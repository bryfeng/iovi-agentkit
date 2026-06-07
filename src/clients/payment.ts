import { DEFAULT_IDS } from '../defaults.js';
import { HttpClient, queryString } from '../http.js';
import type {
  BalanceView,
  BatchView,
  DevnetSubmission,
  LayerRef,
  SemanticLayerAsset,
  SemanticLayerRecord,
  WalletKind,
  WalletRecord
} from '../types.js';

export type PaymentClientOptions = {
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export type RegisterWalletInput = {
  label?: string;
  vk?: string;
  address?: string;
  kind?: WalletKind;
};

export type InitOperatorInput = {
  issuerVk: string;
  layer?: LayerRef;
  operatorWalletAddress?: string;
  baseLayerAccountId?: string;
  resetExisting?: boolean;
};

export type RegisterSemanticLayerInput = {
  name: string;
  layer: LayerRef;
  operatorWalletAddress: string;
  baseLayerAccountId?: string;
  issuerVkRef?: string;
  operatorVkRef?: string;
  assets?: SemanticLayerAsset[];
};

export type MintInput = {
  layer?: LayerRef;
  toAddress: string;
  amount: number;
};

export type TransferInput = {
  layer?: LayerRef;
  fromAddress: string;
  toAddress: string;
  amount: number;
  vk: string;
};

export type SubmitLatestBatchInput = {
  layer?: LayerRef;
  force?: boolean;
  sequence?: number;
  waitForVerifier?: boolean;
  verifierTimeoutSeconds?: number;
  verifierPollIntervalSeconds?: number;
};

export type VerifierSyncInput = {
  layer?: LayerRef;
  postingOwner?: string | null;
  expectedSequence?: number;
  expectedStateHash?: string;
  timeoutSeconds?: number;
  pollIntervalSeconds?: number;
};

export class PaymentClient {
  readonly http: HttpClient;

  constructor(baseUrl: string | undefined, options: PaymentClientOptions = {}) {
    this.http = new HttpClient(baseUrl, 'Payment SL', options);
  }

  get baseUrl(): string {
    return this.http.baseUrl;
  }

  health(): Promise<Record<string, unknown>> {
    return this.http.get('/health');
  }

  config(): Promise<Record<string, unknown>> {
    return this.http.get('/config');
  }

  registerWallet(input: RegisterWalletInput): Promise<WalletRecord> {
    return this.http.post('/wallets', {
      label: input.label,
      vk: input.vk,
      address: input.address,
      kind: input.kind ?? 'user'
    });
  }

  listWallets(): Promise<{ wallets: WalletRecord[] }> {
    return this.http.get('/wallets');
  }

  initOperator(input: InitOperatorInput): Promise<Record<string, unknown>> {
    return this.http.post('/operator/init', {
      issuer_vk: input.issuerVk,
      reset_existing: input.resetExisting ?? false,
      sl_id: input.layer?.slId ?? DEFAULT_IDS.paymentSlId,
      version: input.layer?.version ?? DEFAULT_IDS.version,
      operator_wallet_address: input.operatorWalletAddress,
      base_layer_account_id: input.baseLayerAccountId
    });
  }

  registerSemanticLayer(input: RegisterSemanticLayerInput): Promise<SemanticLayerRecord> {
    return this.http.post('/semantic-layers', {
      name: input.name,
      sl_id: input.layer.slId,
      version: input.layer.version ?? DEFAULT_IDS.version,
      operator_wallet_address: input.operatorWalletAddress,
      base_layer_account_id: input.baseLayerAccountId,
      issuer_vk_ref: input.issuerVkRef,
      operator_vk_ref: input.operatorVkRef,
      assets: input.assets ?? []
    });
  }

  registerAsset(layer: LayerRef, asset: SemanticLayerAsset): Promise<Record<string, unknown>> {
    return this.http.post(
      `/semantic-layers/${layer.slId}/assets${queryString({ version: layer.version ?? DEFAULT_IDS.version })}`,
      asset
    );
  }

  listSemanticLayers(): Promise<{ semantic_layers: SemanticLayerRecord[] }> {
    return this.http.get('/semantic-layers');
  }

  mint(input: MintInput): Promise<Record<string, unknown>> {
    return this.http.post('/actions/mint', {
      to_address: input.toAddress,
      amount: input.amount,
      ...layerBody(input.layer)
    });
  }

  transfer(input: TransferInput): Promise<Record<string, unknown>> {
    return this.http.post('/actions/transfer', {
      from_address: input.fromAddress,
      to_address: input.toAddress,
      amount: input.amount,
      vk: input.vk,
      ...layerBody(input.layer)
    });
  }

  pending(layer?: LayerRef): Promise<Record<string, unknown>> {
    return this.http.get(`/pending${layerQuery(layer)}`);
  }

  batch(layer?: LayerRef): Promise<{ batched: boolean; batch?: BatchView; operator_state?: unknown; message?: string; sl_id: string; version: string }> {
    return this.http.post(`/operator/batch${layerQuery(layer)}`);
  }

  batches(layer?: LayerRef): Promise<{ batches: BatchView[]; sl_id: string; version: string }> {
    return this.http.get(`/operator/batches${layerQuery(layer)}`);
  }

  latestPayload(layer?: LayerRef): Promise<{
    sequence: number;
    payload_hex: string;
    payload_size: number;
    data_scalars: string[];
    data_len: number;
    sl_id: string;
    version: string;
  }> {
    return this.http.get(`/operator/latest-payload${layerQuery(layer)}`);
  }

  devnetStatus(layer?: LayerRef): Promise<Record<string, unknown>> {
    return this.http.get(`/devnet/status${layerQuery(layer)}`);
  }

  submitLatestBatch(input: SubmitLatestBatchInput = {}): Promise<{
    submitted: boolean;
    sequence: number;
    devnet_submission: DevnetSubmission;
    verification?: Record<string, unknown> | null;
    batch: BatchView;
    sl_id: string;
    version: string;
  }> {
    return this.http.post('/devnet/submit-latest-batch', {
      force: input.force ?? false,
      sequence: input.sequence,
      sl_id: input.layer?.slId ?? DEFAULT_IDS.paymentSlId,
      version: input.layer?.version ?? DEFAULT_IDS.version,
      wait_for_verifier: input.waitForVerifier ?? true,
      verifier_timeout_seconds: input.verifierTimeoutSeconds ?? 120,
      verifier_poll_interval_seconds: input.verifierPollIntervalSeconds ?? 5
    }, { timeoutMs: (input.verifierTimeoutSeconds ?? 120) * 1000 + 10_000 });
  }

  syncVerifier(input: VerifierSyncInput = {}): Promise<Record<string, unknown>> {
    return this.http.post('/verifier/sync', {
      sl_id: input.layer?.slId ?? DEFAULT_IDS.paymentSlId,
      version: input.layer?.version ?? DEFAULT_IDS.version,
      posting_owner: input.postingOwner,
      expected_sequence: input.expectedSequence,
      expected_state_hash: input.expectedStateHash,
      timeout_seconds: input.timeoutSeconds ?? 0,
      poll_interval_seconds: input.pollIntervalSeconds ?? 5
    }, { timeoutMs: (input.timeoutSeconds ?? 0) * 1000 + 10_000 });
  }

  acceptLatestBatch(layer?: LayerRef): Promise<Record<string, unknown>> {
    return this.http.post(`/verifier/accept-latest-batch${layerQuery(layer)}`);
  }

  verifierState(layer?: LayerRef): Promise<Record<string, unknown>> {
    return this.http.get(`/verifier/state${layerQuery(layer)}`);
  }

  verifierLog(layer?: LayerRef): Promise<Record<string, unknown>> {
    return this.http.get(`/verifier/log${layerQuery(layer)}`);
  }

  balance(address: string, input: { source?: 'operator' | 'verifier'; layer?: LayerRef } = {}): Promise<BalanceView> {
    return this.http.get(`/balances/${address}${queryString({
      source: input.source ?? 'verifier',
      sl_id: input.layer?.slId,
      version: input.layer?.version,
      asset_id: input.layer?.assetId
    })}`);
  }
}

export function layerQuery(layer?: LayerRef): string {
  return queryString({
    sl_id: layer?.slId,
    version: layer?.version,
    asset_id: layer?.assetId
  });
}

function layerBody(layer?: LayerRef): Record<string, string | undefined> {
  return {
    sl_id: layer?.slId,
    version: layer?.version,
    asset_id: layer?.assetId
  };
}
