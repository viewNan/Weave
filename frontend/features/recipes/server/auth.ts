import { RecipeError } from '../domain.ts';
export function localDevelopment(request: Request, development: boolean) {
  return development && ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(request.url).hostname);
}
export function requireSameOrigin(request: Request, development = process.env.NODE_ENV === 'development') {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  // Next dev normalizes the request URL to localhost even when opened at 127.0.0.1.
  if (localDevelopment(request, development) && host && origin === `http://${host}` &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname)) return;
  if (origin !== new URL(request.url).origin) throw new RecipeError('请求来源无效，请从本站页面操作。', 403);
}
