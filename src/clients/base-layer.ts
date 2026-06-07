import { HttpClient, queryString } from '../http.js';

export type TransferWithDataInput = {
  recipient: string;
  amount: number;
  fee: number;
  data?: string[];
};

export class BaseLayerClient {
  readonly http: HttpClient;

  constructor(baseUrl: string | undefined, options: { timeoutMs?: number; headers?: Record<string, string> } = {}) {
    this.http = new HttpClient(baseUrl, 'Base-Layer API', options);
  }

  get baseUrl(): string {
    return this.http.baseUrl;
  }

  health(): Promise<Record<string, unknown>> {
    return this.http.get('/health');
  }

  walletAddress(): Promise<Record<string, unknown>> {
    return this.http.get('/wallet/address');
  }

  balance(owner?: string): Promise<Record<string, unknown>> {
    return this.http.get(`/balance${queryString({ owner })}`);
  }

  utxos(input: { owner?: string; limit?: number } = {}): Promise<Record<string, unknown>[]> {
    return this.http.get(`/utxos${queryString(input)}`);
  }

  transaction(hash: string): Promise<Record<string, unknown>> {
    return this.http.get(`/transactions/${encodeURIComponent(hash)}`);
  }

  transferWithData(input: TransferWithDataInput): Promise<Record<string, unknown>> {
    return this.http.post('/transactions/transfer', {
      recipient: input.recipient,
      amount: input.amount,
      fee: input.fee,
      data: input.data ?? []
    });
  }
}
