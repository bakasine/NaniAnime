import { handleSubjectsRequest } from '../../../server/bangumi-proxy.js';

export function onRequest(context) {
  return handleSubjectsRequest(context.request);
}
