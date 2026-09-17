declare global {
  interface CloudflareEnv {
    PUSH_SUBSCRIPTIONS_DB?: {
      prepare(query: string): { bind(...values: string[]): { run(): Promise<unknown>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }> } };
    };
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_SUBJECT?: string;
    INTERNAL_API_TOKEN?: string;
    OPENAI_API_KEY?: string;
  }
}

export {};
