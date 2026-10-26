export async function atlasRequest<T>(path = '', method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/internal/recipes/atlas/maps${path}`, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Atlas 请求未完成。');
  return data as T;
}
