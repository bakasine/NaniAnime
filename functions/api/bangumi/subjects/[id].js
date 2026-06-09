import { handleSubjectDetailRequest } from '../../../../server/bangumi-proxy.js';

export function onRequest(context) {
  return handleSubjectDetailRequest(context.request, context.params.id);
}
