import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import ts from 'typescript';

function load(file, mocks, globals = {}) {
  const source = ts.transpileModule(
    fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }
  ).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: (name) => {
      if (!(name in mocks)) throw Error(`Unexpected import: ${name}`);
      return mocks[name];
    },
    performance,
    console: { info() {} },
    AbortController,
    URLSearchParams,
    ...globals,
  });
  return exports;
}

const pending = {
  jobId: 'job',
  saved: true,
  comparisonStatus: 'PENDING',
  comparisonRequestId: 'request-1',
};
const completed = { ...pending, comparisonStatus: 'COMPLETED', matchScore: 85 };

test('save returns the queued job without any AI call', async () => {
  const calls = [];
  const { saveJob } = load(
    'src/app/dashboard/search-results/action.ts',
    {
      'next/cache': { revalidatePath() {} },
      'next/dist/client/components/redirect-error': { isRedirectError: () => false },
      '@/lib/server-api-client': {
        serverApiFetch: async (path) => {
          calls.push(path);
          return pending;
        },
      },
    },
    {
      fetch: () => {
        throw Error('Saving must not call AI');
      },
    }
  );
  const result = await saveJob(pending);
  assert.equal(result.ok, true);
  assert.equal(result.data, pending);
  assert.deepEqual(calls, ['/saved-jobs/prepare']);
});

test('save rejects a malformed backend response', async () => {
  const { saveJob } = load('src/app/dashboard/search-results/action.ts', {
    'next/cache': { revalidatePath() {} },
    'next/dist/client/components/redirect-error': { isRedirectError: () => false },
    '@/lib/server-api-client': { serverApiFetch: async () => undefined },
  });
  const result = await saveJob(pending);
  assert.equal(result.ok, false);
  assert.match(result.error, /invalid response/);
});

// A small effect/timer harness exercises the actual hook's polling and cleanup without a browser.
function pollingHarness(fetchImpl) {
  const redirects = [];
  const refs = [],
    states = [],
    effects = [],
    timers = new Map(),
    updates = [],
    requests = [];
  let refIndex,
    stateIndex,
    effectIndex,
    timerId = 0;
  const react = {
    useRef: (value) => {
      const index = refIndex++;
      return (refs[index] ??= { current: value });
    },
    useState: (initial) => {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (value) => {
          states[index] = value;
        },
      ];
    },
    useEffect: (callback, deps) => {
      const index = effectIndex++;
      if (!effects[index] || deps.some((value, i) => value !== effects[index].deps[i])) {
        effects[index]?.cleanup?.();
        effects[index] = { deps, pending: callback };
      }
    },
  };
  const { useJobComparisonPolling } = load(
    'src/hooks/use-job-comparison-polling.ts',
    { react },
    {
      setTimeout: (callback, delay) => {
        const id = ++timerId;
        timers.set(id, { callback, delay });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      fetch: async (...args) => {
        requests.push(args);
        return fetchImpl(...args);
      },
      window: { location: { assign: (url) => redirects.push(url) } },
    }
  );
  return {
    redirects,
    updates,
    timers,
    requests,
    render(jobs, busy = new Set()) {
      refIndex = stateIndex = effectIndex = 0;
      // eslint-disable-next-line react-hooks/rules-of-hooks -- This harness provides the hook dispatcher and effect lifecycle.
      const error = useJobComparisonPolling(jobs, (job) => updates.push(job), busy);
      for (const effect of effects) {
        if (effect.pending) {
          effect.cleanup = effect.pending();
          delete effect.pending;
        }
      }
      return error;
    },
    async tick() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      timer.callback();
      await setImmediate();
    },
    unmount() {
      effects.forEach((effect) => effect.cleanup?.());
    },
  };
}

test('polling batches only pending jobs and applies completed results', async () => {
  const harness = pollingHarness(async () => ({ ok: true, json: async () => [completed] }));
  harness.render([pending, { ...completed, jobId: 'already-done' }]);
  await harness.tick();
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.requests[0][0], '/api/saved-jobs/status?jobId=job');
  assert.equal(harness.updates[0], completed);
  harness.render([completed]);
  assert.equal(harness.timers.size, 0);
});

test('unsaving aborts a pending fetch and ignores its eventual result', async () => {
  let resolve;
  const harness = pollingHarness(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  harness.render([pending]);
  await harness.tick();
  harness.render([{ ...pending, saved: false }]);
  assert.equal(harness.requests[0][1].signal.aborted, true);
  resolve({ ok: true, json: async () => [completed] });
  await setImmediate();
  assert.equal(harness.updates.length, 0);
  assert.equal(harness.timers.size, 0);
});

test('a superseded request cannot overwrite a newer comparison', async () => {
  const harness = pollingHarness(async () => ({ ok: true, json: async () => [completed] }));
  harness.render([{ ...pending, comparisonRequestId: 'request-2' }]);
  await harness.tick();
  assert.equal(harness.updates.length, 0);
  harness.unmount();
});

test('polling backs off after an outage and resumes without overlapping requests', async () => {
  const harness = pollingHarness(async () => {
    throw Error('offline');
  });
  harness.render([pending]);
  await harness.tick();
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.timers.size, 1);
  assert.equal([...harness.timers.values()][0].delay, 4000);
  harness.unmount();
  assert.equal(harness.timers.size, 0);
});

test('busy jobs and completed jobs do not start polling', () => {
  const harness = pollingHarness(() => {
    throw Error('Must not fetch');
  });
  harness.render([pending], new Set(['job']));
  assert.equal(harness.timers.size, 0);
  harness.render([completed]);
  assert.equal(harness.timers.size, 0);
});

test('leaving a page ignores a late unauthorized polling response', async () => {
  let resolve;
  const harness = pollingHarness(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  harness.render([pending]);
  await harness.tick();
  harness.unmount();
  resolve({ status: 401 });
  await setImmediate();
  assert.equal(harness.redirects.length, 0);
});

test('forbidden polling response retries without redirecting to login', async () => {
  const harness = pollingHarness(async () => ({ ok: false, status: 403 }));
  harness.render([pending]);
  await harness.tick();
  assert.equal(harness.redirects.length, 0);
  assert.equal(harness.timers.size, 1);
  harness.unmount();
});

test('active unauthorized polling response still redirects to login', async () => {
  const harness = pollingHarness(async () => ({ ok: false, status: 401 }));
  harness.render([pending]);
  await harness.tick();
  assert.deepEqual(harness.redirects, ['/login?reason=unauthorized']);
  harness.unmount();
});

for (const status of [401, 403, 500]) {
  test(`backend status ${status} redirects only for an authentication failure`, async () => {
    const redirects = [];
    const redirectError = new Error('Login redirect');
    const { serverApiFetch } = load(
      'src/lib/server-api-client.ts',
      {
        'next/headers': { cookies: async () => ({ get: () => ({ value: 'test-token' }) }) },
        'next/navigation': {
          redirect: (url) => {
            redirects.push(url);
            throw redirectError;
          },
        },
      },
      {
        process: { env: { SPRING_BASE_URL: 'http://test' } },
        fetch: async () => new Response('Request failed', { status }),
      }
    );
    await assert.rejects(serverApiFetch('/jobs'), (error) =>
      status === 401 ? error === redirectError : error !== redirectError
    );
    assert.equal(redirects.length, status === 401 ? 1 : 0);
  });
}
