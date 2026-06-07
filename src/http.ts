export type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;
  readonly url: string;

  constructor(status: number, detail: unknown, url: string) {
    super(typeof detail === 'string' ? detail : `API request failed with ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.url = url;
  }
}

export class MissingServiceUrlError extends Error {
  constructor(serviceName: string) {
    super(`${serviceName} URL is not configured`);
    this.name = 'MissingServiceUrlError';
  }
}

export function normalizeBaseUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/+$/, '');
}

export class HttpClient {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly headers: Record<string, string>;

  constructor(baseUrl: string | undefined, serviceName: string, options: { timeoutMs?: number; headers?: Record<string, string> } = {}) {
    const normalized = normalizeBaseUrl(baseUrl);
    if (!normalized) throw new MissingServiceUrlError(serviceName);
    this.baseUrl = normalized;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.headers = options.headers ?? {};
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      accept: 'application/json',
      ...this.headers,
      ...options.headers
    };

    let body: string | undefined;
    if (options.body !== undefined) {
      headers['content-type'] = headers['content-type'] ?? 'application/json';
      body = JSON.stringify(options.body);
    }

    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs)
    });

    const text = await response.text();
    const parsed = parseResponseBody(text);

    if (!response.ok) {
      const detail = isRecord(parsed) && 'detail' in parsed ? parsed.detail : parsed || response.statusText;
      throw new ApiError(response.status, detail, url);
    }

    return parsed as T;
  }

  get<T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }
}

function parseResponseBody(text: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function queryString(values: Record<string, string | number | boolean | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}
