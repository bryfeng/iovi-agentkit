import type { CustodyMode, JsonValue, VerificationMode } from './types.js';

export type ReceiptStatus = 'pending' | 'submitted' | 'verified' | 'accepted' | 'rejected' | 'failed' | 'skipped';

export type ReceiptEvidence = {
  payload?: {
    sl_id?: string;
    version?: string;
    sequence?: number;
    prev_state_hash?: string;
    new_state_hash?: string;
    payload_hex?: string;
    data_scalars?: string[];
    data_len?: number;
  };
  base_post?: {
    network_id?: string;
    tx_hash?: string;
    utxo_id?: string | null;
    owner?: string | null;
    output_index?: number;
    amount?: string;
  };
  verifier?: {
    event_key?: string | null;
    sequence?: number;
    state_hash?: string;
    accepted?: boolean;
    source?: string | null;
  };
  quote?: Record<string, JsonValue>;
};

export type AgentTaskReceipt<TDetails extends Record<string, unknown> = Record<string, unknown>> = {
  schema: 'iovi.agent.receipt.v1';
  id: string;
  task: string;
  status: ReceiptStatus;
  custody_mode: CustodyMode;
  verification_mode: VerificationMode;
  created_at: string;
  updated_at: string;
  services: Record<string, string | undefined>;
  evidence: ReceiptEvidence;
  details: TDetails;
};

export type ReceiptInput<TDetails extends Record<string, unknown> = Record<string, unknown>> = {
  task: string;
  status: ReceiptStatus;
  custodyMode: CustodyMode;
  verificationMode: VerificationMode;
  services: Record<string, string | undefined>;
  evidence?: ReceiptEvidence;
  details?: TDetails;
  id?: string;
};

export function createReceipt<TDetails extends Record<string, unknown> = Record<string, unknown>>(
  input: ReceiptInput<TDetails>
): AgentTaskReceipt<TDetails> {
  const now = new Date().toISOString();
  return {
    schema: 'iovi.agent.receipt.v1',
    id: input.id ?? `task_${crypto.randomUUID()}`,
    task: input.task,
    status: input.status,
    custody_mode: input.custodyMode,
    verification_mode: input.verificationMode,
    created_at: now,
    updated_at: now,
    services: input.services,
    evidence: input.evidence ?? {},
    details: (input.details ?? {}) as TDetails
  };
}

export function updateReceipt<TDetails extends Record<string, unknown>>(
  receipt: AgentTaskReceipt<TDetails>,
  patch: Partial<Pick<AgentTaskReceipt<TDetails>, 'status' | 'evidence' | 'details'>>
): AgentTaskReceipt<TDetails> {
  return {
    ...receipt,
    ...patch,
    evidence: {
      ...receipt.evidence,
      ...patch.evidence
    },
    details: {
      ...receipt.details,
      ...patch.details
    },
    updated_at: new Date().toISOString()
  };
}
