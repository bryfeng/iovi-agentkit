export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type ServiceUrls = {
  paymentSlUrl?: string;
  verifierUrl?: string;
  bundlerUrl?: string;
  baseLayerUrl?: string;
};

export type AgentKitOptions = ServiceUrls & {
  timeoutMs?: number;
  headers?: Record<string, string>;
  profile?: 'sandbox' | 'custom';
};

export type LayerRef = {
  slId: string;
  version?: string;
  assetId?: string;
};

export type WalletKind = 'user' | 'sl_operator' | 'coordinator' | 'verifier';

export type WalletRecord = {
  label: string;
  address: string;
  kind: WalletKind;
  derived_from_vk?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SemanticLayerAsset = {
  asset_id: string;
  symbol: string;
  name: string;
  decimals?: number;
  asset_type?: string;
  metadata?: Record<string, unknown>;
};

export type SemanticLayerRecord = {
  name: string;
  sl_id: string;
  version: string;
  operator_wallet_address: string;
  base_layer_account_id?: string | null;
  issuer_vk_ref?: string | null;
  operator_vk_ref?: string | null;
  assets?: SemanticLayerAsset[];
};

export type BalanceView = {
  address: string;
  asset_id: string;
  balance: number;
  frozen: boolean;
  source: 'operator' | 'verifier';
  state_hash: string;
  sl_id: string;
  version: string;
};

export type BatchView = {
  status: string;
  sequence: number;
  action_count: number;
  applied: number;
  rejected: unknown[];
  prev_state_hash: string;
  new_state_hash: string;
  payload_hex: string;
  payload_size: number;
  data_scalars: string[];
  data_len: number;
  sl_id: string;
  version: string;
  devnet_submission?: DevnetSubmission;
  verification?: unknown;
  verified?: boolean;
  effective_status?: string;
  verification_source?: string | null;
  devnet_backed?: boolean;
};

export type DevnetSubmission = {
  status: string;
  network_id: string;
  api_url?: string;
  submitter?: string;
  sequence: number;
  tx_hash: string;
  utxo_id?: string | null;
  spent_utxo?: string | null;
  owner?: string | null;
  output_index?: number;
  amount?: string;
  payload_hex: string;
  data_len: number;
  data_scalars: string[];
};

export type VerifierCheckpoint = {
  sl_id: string;
  version: string;
  sequence: number;
  state: Record<string, unknown>;
  state_hash: string;
};

export type BaseEvent = {
  cursor: string;
  network_id?: string;
  height?: number;
  block_hash?: string | null;
  tx_hash: string;
  tx_index?: number;
  output_index?: number;
  utxo_id?: string | null;
  owner?: string | null;
  amount?: string;
  data_scalars?: string[];
  payload_hex?: string | null;
  event_key?: string | null;
};

export type AssetRef = {
  sl_id: string;
  version: string;
  asset_id: string;
};

export type QuoteExactIn = {
  pool_id: string;
  input_asset: AssetRef;
  output_asset: AssetRef;
  amount_in: number;
  amount_out: number;
  fee_bps: number;
};

export type MarketAssetRecord = {
  ref: AssetRef;
  asset: {
    asset_id: string;
    symbol?: string;
    name?: string;
    metadata?: Record<string, unknown>;
    require_allowlist?: boolean;
  };
  state_hash?: string;
  sequence?: number;
  source?: {
    type?: string;
    framework?: string;
    url?: string;
  };
  capabilities?: string[];
  market_status?: string;
};

export type CustodyMode = 'sandbox-vk' | 'local-key' | 'remote-poster' | 'watch-only';

export type VerificationMode = 'local' | 'devnet' | 'none';
