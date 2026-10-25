interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number }): Promise<{ objects: Array<{ name: string; key: string }> }>;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2ObjectHead | null>;
  put(key: string, value: string | ArrayBuffer | Blob | ReadableStream, options?: {
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
  }): Promise<void>;
  delete(key: string | string[]): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ objects: Array<{ key: string; size?: number; uploaded?: Date }>; truncated?: boolean; cursor?: string }>;
}

interface R2ObjectHead {
  customMetadata?: Record<string, string>;
}

interface R2ObjectBody {
  body: ReadableStream | null;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
}
