export async function recipeRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/internal/recipes${path}`, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (response.status === 401) window.dispatchEvent(new Event('eat-locked'));
  if (!response.ok) throw new Error(data?.error || '请求未完成，请重试。');
  return data as T;
}
