import type { PaymentClient } from '../clients/payment.js';
import { DEFAULT_IDS } from '../defaults.js';
import { createReceipt, updateReceipt, type AgentTaskReceipt } from '../receipts.js';
import type {
  BatchView,
  CustodyMode,
  LayerRef,
  SemanticLayerAsset,
  VerificationMode,
  WalletRecord
} from '../types.js';

export type PaymentWorkflowServices = {
  paymentSlUrl?: string;
  verifierUrl?: string;
  baseLayerUrl?: string;
  bundlerUrl?: string;
};

export type CreatePaymentLayerInput = {
  name: string;
  layer: LayerRef;
  issuerVk: string;
  operator: {
    label?: string;
    vk?: string;
    address?: string;
  };
  baseLayerAccountId?: string;
  assets?: SemanticLayerAsset[];
  resetExisting?: boolean;
  custodyMode?: CustodyMode;
};

export type PaymentActionInput = {
  layer?: LayerRef;
  verificationMode?: VerificationMode;
  custodyMode?: CustodyMode;
};

export type MintAndVerifyInput = PaymentActionInput & {
  toAddress: string;
  amount: number;
};

export type TransferAndVerifyInput = PaymentActionInput & {
  fromAddress: string;
  toAddress: string;
  amount: number;
  vk: string;
};

export type BatchAndVerifyInput = PaymentActionInput & {
  force?: boolean;
  sequence?: number;
  verifierTimeoutSeconds?: number;
  verifierPollIntervalSeconds?: number;
};

export class PaymentWorkflow {
  readonly payment: PaymentClient;
  readonly services: PaymentWorkflowServices;

  constructor(payment: PaymentClient, services: PaymentWorkflowServices) {
    this.payment = payment;
    this.services = services;
  }

  async createLayer(input: CreatePaymentLayerInput): Promise<AgentTaskReceipt> {
    const layer = normalizeLayer(input.layer);
    const receipt = createReceipt<Record<string, unknown>>({
      task: 'payment.create_layer',
      status: 'pending',
      custodyMode: input.custodyMode ?? 'sandbox-vk',
      verificationMode: 'none',
      services: this.services,
      details: {
        sl_id: layer.slId,
        version: layer.version,
        name: input.name
      }
    });

    const operatorWallet = await this.payment.registerWallet({
      label: input.operator.label ?? 'Payment SL Operator',
      vk: input.operator.vk,
      address: input.operator.address,
      kind: 'sl_operator'
    });

    const initialized = await this.payment.initOperator({
      issuerVk: input.issuerVk,
      layer,
      operatorWalletAddress: operatorWallet.address,
      baseLayerAccountId: input.baseLayerAccountId,
      resetExisting: input.resetExisting ?? false
    });

    const semanticLayer = await this.payment.registerSemanticLayer({
      name: input.name,
      layer,
      operatorWalletAddress: operatorWallet.address,
      baseLayerAccountId: input.baseLayerAccountId,
      issuerVkRef: `local:${operatorWallet.address}`,
      operatorVkRef: `local:${operatorWallet.address}`,
      assets: input.assets ?? []
    });

    return updateReceipt(receipt, {
      status: 'accepted',
      details: {
        operator_wallet: operatorWallet,
        initialized,
        semantic_layer: semanticLayer
      }
    });
  }

  async mintAndVerify(input: MintAndVerifyInput): Promise<AgentTaskReceipt> {
    const layer = normalizeLayer(input.layer);
    const receipt = createReceipt<Record<string, unknown>>({
      task: 'payment.mint',
      status: 'pending',
      custodyMode: input.custodyMode ?? 'sandbox-vk',
      verificationMode: input.verificationMode ?? 'local',
      services: this.services,
      details: {
        sl_id: layer.slId,
        version: layer.version,
        asset_id: layer.assetId,
        to_address: input.toAddress,
        amount: input.amount
      }
    });

    const queued = await this.payment.mint({
      layer,
      toAddress: input.toAddress,
      amount: input.amount
    });
    const final = await this.batchAndVerify({
      layer,
      verificationMode: input.verificationMode ?? 'local',
      custodyMode: input.custodyMode ?? 'sandbox-vk'
    });
    const balance = await safeBalance(this.payment, input.toAddress, layer);

    return updateReceipt(receipt, {
      status: final.status,
      evidence: final.evidence,
      details: {
        queued,
        batch_receipt: final,
        balance
      }
    });
  }

  async transferAndVerify(input: TransferAndVerifyInput): Promise<AgentTaskReceipt> {
    const layer = normalizeLayer(input.layer);
    const receipt = createReceipt<Record<string, unknown>>({
      task: 'payment.transfer',
      status: 'pending',
      custodyMode: input.custodyMode ?? 'sandbox-vk',
      verificationMode: input.verificationMode ?? 'local',
      services: this.services,
      details: {
        sl_id: layer.slId,
        version: layer.version,
        asset_id: layer.assetId,
        from_address: input.fromAddress,
        to_address: input.toAddress,
        amount: input.amount
      }
    });

    const queued = await this.payment.transfer({
      layer,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      amount: input.amount,
      vk: input.vk
    });
    const final = await this.batchAndVerify({
      layer,
      verificationMode: input.verificationMode ?? 'local',
      custodyMode: input.custodyMode ?? 'sandbox-vk'
    });
    const fromBalance = await safeBalance(this.payment, input.fromAddress, layer);
    const toBalance = await safeBalance(this.payment, input.toAddress, layer);

    return updateReceipt(receipt, {
      status: final.status,
      evidence: final.evidence,
      details: {
        queued,
        batch_receipt: final,
        from_balance: fromBalance,
        to_balance: toBalance
      }
    });
  }

  async batchAndVerify(input: BatchAndVerifyInput = {}): Promise<AgentTaskReceipt> {
    const layer = normalizeLayer(input.layer);
    const verificationMode = input.verificationMode ?? 'local';
    const receipt = createReceipt<Record<string, unknown>>({
      task: 'payment.batch',
      status: 'pending',
      custodyMode: input.custodyMode ?? (verificationMode === 'devnet' ? 'remote-poster' : 'sandbox-vk'),
      verificationMode,
      services: this.services,
      details: {
        sl_id: layer.slId,
        version: layer.version,
        asset_id: layer.assetId,
        sequence: input.sequence
      }
    });

    const batchResult = input.sequence
      ? { batched: true, batch: await findExistingBatch(this.payment, layer, input.sequence), sl_id: layer.slId, version: layer.version }
      : await this.payment.batch(layer);

    if (!batchResult.batched || !batchResult.batch) {
      return updateReceipt(receipt, {
        status: 'skipped',
        details: {
          message: batchResult.message ?? 'No pending actions. Nothing to batch.'
        }
      });
    }

    const batch = batchResult.batch;
    if (verificationMode === 'none') {
      return updateReceipt(receipt, {
        status: 'submitted',
        evidence: evidenceFromBatch(batch),
        details: { batch }
      });
    }

    if (verificationMode === 'devnet') {
      const submitted = await this.payment.submitLatestBatch({
        layer,
        sequence: input.sequence ?? batch.sequence,
        force: input.force ?? false,
        waitForVerifier: true,
        verifierTimeoutSeconds: input.verifierTimeoutSeconds ?? 120,
        verifierPollIntervalSeconds: input.verifierPollIntervalSeconds ?? 5
      });
      return updateReceipt(receipt, {
        status: submitted.verification && submitted.verification['verified'] === true ? 'verified' : 'submitted',
        evidence: evidenceFromBatch(submitted.batch, submitted.devnet_submission, submitted.verification),
        details: {
          batch: submitted.batch,
          devnet_submission: submitted.devnet_submission,
          verification: submitted.verification
        }
      });
    }

    const accepted = await this.payment.acceptLatestBatch(layer);
    const verifiedState = await this.payment.verifierState(layer);
    return updateReceipt(receipt, {
      status: 'verified',
      evidence: evidenceFromBatch(batch, undefined, {
        accepted: accepted['accepted'],
        sequence: accepted['sequence'],
        state_hash: stateHashFromVerifierState(verifiedState),
        source: 'local_replay'
      }),
      details: {
        batch,
        accepted,
        verifier_state: verifiedState
      }
    });
  }
}

export function normalizeLayer(layer?: LayerRef): Required<Pick<LayerRef, 'slId' | 'version'>> & Pick<LayerRef, 'assetId'> {
  return {
    slId: layer?.slId ?? DEFAULT_IDS.paymentSlId,
    version: layer?.version ?? DEFAULT_IDS.version,
    assetId: layer?.assetId
  };
}

function evidenceFromBatch(
  batch: BatchView,
  submission?: Record<string, unknown>,
  verification?: Record<string, unknown> | null
) {
  return {
    payload: {
      sl_id: batch.sl_id,
      version: batch.version,
      sequence: batch.sequence,
      prev_state_hash: batch.prev_state_hash,
      new_state_hash: batch.new_state_hash,
      payload_hex: batch.payload_hex,
      data_scalars: batch.data_scalars,
      data_len: batch.data_len
    },
    base_post: submission
      ? {
          network_id: asString(submission['network_id']),
          tx_hash: asString(submission['tx_hash']),
          utxo_id: asNullableString(submission['utxo_id']),
          owner: asNullableString(submission['owner']),
          output_index: asNumber(submission['output_index']),
          amount: asString(submission['amount'])
        }
      : undefined,
    verifier: verification
      ? {
          event_key: asNullableString(verification['event_key']),
          sequence: asNumber(verification['sequence'] ?? verification['expected_sequence']),
          state_hash: asString(verification['state_hash'] ?? verification['expected_state_hash']),
          accepted: verification['accepted'] === true || verification['verified'] === true,
          source: asNullableString(verification['source'] ?? verification['verification_source'])
        }
      : undefined
  };
}

async function findExistingBatch(payment: PaymentClient, layer: LayerRef, sequence: number): Promise<BatchView> {
  const batches = await payment.batches(layer);
  const batch = batches.batches.find((item) => item.sequence === sequence);
  if (!batch) throw new Error(`Payment batch ${sequence} not found`);
  return batch;
}

async function safeBalance(payment: PaymentClient, address: string, layer: LayerRef) {
  try {
    return await payment.balance(address, { source: 'verifier', layer });
  } catch (error) {
    return {
      unavailable: true,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

function stateHashFromVerifierState(value: Record<string, unknown>): string | undefined {
  const state = value['state'];
  if (isRecord(state) && typeof state['state_hash'] === 'string') return state['state_hash'];
  if (typeof value['state_hash'] === 'string') return value['state_hash'];
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  return value === null ? null : asString(value);
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
