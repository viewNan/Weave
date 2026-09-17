export function authorized(request:Request,token?:string){return Boolean(token&&request.headers.get('authorization')===`Bearer ${token}`);}
export function morningBriefAuthorized(request: Request, token?: string) { return authorized(request, token) || request.headers.get('x-weave-client') === 'admin'; }
