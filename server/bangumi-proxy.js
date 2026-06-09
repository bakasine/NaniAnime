const BANGUMI_SEARCH_URL = 'https://api.bgm.tv/v0/search/subjects';
const BANGUMI_SUBJECTS_URL = 'https://api.bgm.tv/v0/subjects';
const BANGUMI_USER_AGENT = 'uerax/NaniAnime';
const MAX_BODY_SIZE = 16 * 1024;

function jsonResponse(status, data, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

function methodNotAllowed(method) {
  return jsonResponse(405, { error: 'Method Not Allowed' }, { allow: method });
}

function upstreamHeaders(contentType) {
  const headers = {
    'user-agent': BANGUMI_USER_AGENT,
  };

  if (contentType) {
    headers['content-type'] = contentType;
  }

  return headers;
}

async function readLimitedBody(request) {
  const contentLength = Number(request.headers.get('content-length') || 0);

  if (contentLength > MAX_BODY_SIZE) {
    throw new Error('request body too large');
  }

  const body = await request.text();
  const byteLength = new TextEncoder().encode(body).byteLength;

  if (byteLength > MAX_BODY_SIZE) {
    throw new Error('request body too large');
  }

  return body;
}

async function forwardResponse(response) {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function badGateway() {
  return jsonResponse(502, { error: 'Bangumi API request failed' });
}

export async function handleSubjectsRequest(request) {
  if (request.method !== 'GET') {
    return methodNotAllowed('GET');
  }

  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(BANGUMI_SUBJECTS_URL);
  upstreamUrl.search = requestUrl.search;

  try {
    const response = await fetch(upstreamUrl, {
      headers: upstreamHeaders(),
    });

    return forwardResponse(response);
  } catch (_error) {
    return badGateway();
  }
}

export async function handleSubjectDetailRequest(request, subjectId) {
  if (request.method !== 'GET') {
    return methodNotAllowed('GET');
  }

  if (!/^\d+$/.test(subjectId)) {
    return jsonResponse(400, { error: 'Invalid subject id' });
  }

  try {
    const response = await fetch(`${BANGUMI_SUBJECTS_URL}/${subjectId}`, {
      headers: upstreamHeaders(),
    });

    return forwardResponse(response);
  } catch (_error) {
    return badGateway();
  }
}

export async function handleSearchRequest(request) {
  if (request.method !== 'POST') {
    return methodNotAllowed('POST');
  }

  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(BANGUMI_SEARCH_URL);
  upstreamUrl.search = requestUrl.search;

  try {
    const body = await readLimitedBody(request);
    const response = await fetch(upstreamUrl, {
      method: 'POST',
      headers: upstreamHeaders(request.headers.get('content-type') || 'application/json'),
      body,
    });

    return forwardResponse(response);
  } catch (_error) {
    return badGateway();
  }
}
