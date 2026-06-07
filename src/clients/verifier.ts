import { DEFAULT_IDS } from '../defaults.js';
import { HttpClient, queryString } from '../http.js';
import type { BaseEvent, LayerRef, VerifierCheckpoint } from '../types.js';

export class VerifierClient {
  readonly http: HttpClient;

  constructor(baseUrl: string | undefined, options: { timeoutMs?: number; headers?: Record<string, string> } = {}) {
    this.http = new HttpClient(baseUrl, 'Generic Verifier', options);
  }

  get baseUrl(): string {
    return this.http.baseUrl;
  }

  health(): Promise<Record<string, unknown>> {
    return this.http.get('/health');
  }

  ingestEvent(event: BaseEvent): Promise<Record<string, unknown>> {
    return this.http.post('/verifier/ingest-event', event);
  }

  state(layer: LayerRef): Promise<VerifierCheckpoint> {
    return this.http.get(`/verifier/state${queryString({
      sl_id: layer.slId,
      version: layer.version ?? DEFAULT_IDS.version
    })}`);
  }

  log(layer?: Pick<LayerRef, 'slId'>): Promise<{ log: Record<string, unknown>[] }> {
    return this.http.get(`/verifier/log${queryString({ sl_id: layer?.slId })}`);
  }

  events(): Promise<{ events: Record<string, unknown>[] }> {
    return this.http.get('/verifier/events');
  }
}
