import { handleSearchRequest } from '../../../../server/bangumi-proxy.js';

export function onRequest(context) {
  return handleSearchRequest(context.request);
}
