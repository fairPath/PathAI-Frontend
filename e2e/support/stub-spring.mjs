// A stand-in for Spring, for the Playwright tests. No dependencies.
//
// Next calls Spring from the server (server actions and server components), so
// the browser cannot be intercepted: this is a real HTTP server that Next is
// pointed at through SPRING_BASE_URL.
//
// App endpoints (what the profile page uses):
//   GET  /users/me          -> state.user
//   GET  /resumes/analysis  -> next entry of state.latest (the last one repeats); 204 when empty
//   POST /resumes/analyze   -> state.analyze { status, body }; then state.afterAnalyze replaces state.latest
// Control endpoints (what the tests use):
//   POST /__stub/reset
//   POST /__stub/state      -> merges the JSON body into the state
//   GET  /__stub/requests   -> every app request seen since the last reset
import http from 'node:http';

const PORT = Number(process.env.STUB_SPRING_PORT ?? 4010);

const defaultState = () => ({
  user: {
    firstName: 'Jane',
    lastName: 'Testperson',
    username: 'jane',
    email: 'jane.testperson@example.com',
    resumeId: '00000000-0000-0000-0000-000000000001',
    resumeFileName: 'synthetic-resume.pdf',
    resumeUpdatedAt: '2026-01-01T00:00:00Z',
  },
  latest: [],
  analyze: { status: 202, body: null },
  afterAnalyze: null,
});

let state = defaultState();
let cursor = 0;
let requests = [];

function send(res, status, body) {
  if (body === undefined || body === null || status === 204) {
    res.writeHead(status).end();
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => resolve(raw ? JSON.parse(raw) : {}));
  });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://stub');

  if (pathname === '/__stub/reset') {
    state = defaultState();
    cursor = 0;
    requests = [];
    return send(res, 200, { ok: true });
  }
  if (pathname === '/__stub/state') {
    state = { ...state, ...(await readJson(req)) };
    cursor = 0;
    return send(res, 200, { ok: true });
  }
  if (pathname === '/__stub/requests') {
    return send(res, 200, requests);
  }

  requests.push({
    method: req.method,
    path: pathname,
    hasBearer: (req.headers.authorization ?? '').startsWith('Bearer '),
  });

  if (req.method === 'GET' && pathname === '/users/me') {
    return send(res, 200, state.user);
  }
  if (req.method === 'GET' && pathname === '/resumes/analysis') {
    if (state.latest.length === 0) return send(res, 204);
    const entry = state.latest[Math.min(cursor, state.latest.length - 1)];
    cursor += 1;
    return send(res, 200, entry);
  }
  if (req.method === 'POST' && pathname === '/resumes/analyze') {
    const { status, body, raw } = state.analyze;
    if (state.afterAnalyze) {
      state.latest = state.afterAnalyze;
      cursor = 0;
    }
    if (raw !== undefined) {
      res.writeHead(status, { 'Content-Type': 'text/plain' }).end(raw);
      return;
    }
    return send(res, status, body);
  }

  return send(res, 404, { error: `stub has no route for ${req.method} ${pathname}` });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`stub Spring listening on http://127.0.0.1:${PORT}`);
});
