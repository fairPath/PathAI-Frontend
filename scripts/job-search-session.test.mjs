import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import test from 'node:test';
import ts from 'typescript';

function load(file, mocks = {}, globals = {}) {
  const source = ts.transpileModule(
    fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }
  ).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: (name) => {
      if (!(name in mocks)) throw Error(`Unexpected import: ${name}`);
      return mocks[name];
    },
    URLSearchParams,
    ...globals,
  });
  return exports;
}
const jobSearch = load('src/lib/job-search.ts');
const empty = { titleOnly: '', where: '', jobType: '', salary: '', company: '' };
const filters = {
  titleOnly: 'Software Engineer',
  where: 'New York, NY',
  jobType: 'Full-Time',
  salary: '$100k+',
  company: 'Amazon',
};
const job = {
  jobId: 'job-1',
  saved: false,
  jobDescription: 'Original search description',
  comparisonStatus: null,
};
function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
function session(store) {
  return load(
    'src/lib/job-search-session.ts',
    { '@/lib/job-search': jobSearch },
    { window: { sessionStorage: store } }
  );
}
const plain = (value) => JSON.parse(JSON.stringify(value));

test('returning through the bare Search link restores all filters and results after a reload', async () => {
  const store = storage();
  let calls = 0;
  const search = async () => {
    calls++;
    return [job];
  };
  await session(store).loadSearchSnapshot('owner', filters, 'first-search', search);
  const restored = await session(store).loadSearchSnapshot('owner', empty, '', search);
  assert.equal(calls, 1);
  assert.equal(restored.restored, true);
  assert.deepEqual(plain(restored.snapshot.filters), filters);
  assert.deepEqual(plain(restored.snapshot.draftFilters), filters);
  assert.deepEqual(plain(restored.snapshot.jobs), [job]);
});

test('unsent field edits and the selected card are retained without changing the applied query', async () => {
  const store = storage(),
    cache = session(store);
  const { snapshot } = await cache.loadSearchSnapshot('owner', filters, '', async () => [job]);
  cache.saveSearchSnapshot('owner', {
    ...snapshot,
    draftFilters: { ...filters, where: 'Boston' },
    selectedJobId: job.jobId,
  });
  const restored = await session(store).loadSearchSnapshot('owner', filters, '', async () => {
    throw Error('Must not search');
  });
  assert.equal(restored.snapshot.filters.where, 'New York, NY');
  assert.equal(restored.snapshot.draftFilters.where, 'Boston');
  assert.equal(restored.snapshot.selectedJobId, job.jobId);
});

test('submitting identical parameters explicitly performs a fresh search exactly once', async () => {
  const store = storage(),
    cache = session(store);
  let calls = 0;
  const search = async () => {
    calls++;
    return [{ ...job, title: `result-${calls}` }];
  };
  await cache.loadSearchSnapshot('owner', filters, 'submit-1', search);
  const fresh = await cache.loadSearchSnapshot('owner', filters, 'submit-2', search);
  assert.equal(fresh.snapshot.jobs[0].title, 'result-2');
  const revisited = await session(store).loadSearchSnapshot('owner', filters, 'submit-2', search);
  assert.equal(revisited.restored, true);
  assert.equal(calls, 2);
});

test('simultaneous/replayed effects share one in-flight search', async () => {
  const cache = session(storage());
  let calls = 0,
    resolve;
  const search = () => {
    calls++;
    return new Promise((done) => {
      resolve = done;
    });
  };
  const first = cache.loadSearchSnapshot('owner', filters, 'submit', search);
  const second = cache.loadSearchSnapshot('owner', filters, 'submit', search);
  assert.equal(calls, 1);
  resolve([job]);
  assert.equal((await first).snapshot.jobs[0].jobId, job.jobId);
  assert.equal((await second).snapshot.jobs[0].jobId, job.jobId);
});

test('empty results are restored and first visits do not automatically search', async () => {
  const store = storage(),
    cache = session(store);
  let calls = 0;
  const search = async () => {
    calls++;
    return [];
  };
  const initial = await cache.loadSearchSnapshot('owner', empty, '', search);
  assert.equal(initial.snapshot.hasSearched, false);
  assert.equal(calls, 0);
  await cache.loadSearchSnapshot('owner', filters, '', search);
  const restored = await session(store).loadSearchSnapshot('owner', empty, '', search);
  assert.equal(calls, 1);
  assert.equal(restored.snapshot.hasSearched, true);
  assert.equal(restored.snapshot.jobs.length, 0);
});

test('another login cannot restore the previous login’s results', async () => {
  const cache = session(storage());
  let calls = 0;
  await cache.loadSearchSnapshot('owner-a', filters, '', async () => [job]);
  const another = await cache.loadSearchSnapshot('owner-b', empty, '', async () => {
    calls++;
    return [];
  });
  assert.equal(another.snapshot.hasSearched, false);
  assert.equal(another.snapshot.jobs.length, 0);
  assert.equal(calls, 0);
});

test('corrupt or unavailable storage does not break search or in-memory restoration', async () => {
  const corrupt = { getItem: () => '{broken', setItem() {} };
  const cache = session(corrupt);
  await cache.loadSearchSnapshot('owner', filters, '', async () => [job]);
  const restored = await cache.loadSearchSnapshot('owner', empty, '', async () => {
    throw Error('Must not search');
  });
  assert.equal(restored.snapshot.jobs[0].jobId, job.jobId);
  const unavailable = session({
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('full');
    },
  });
  await unavailable.loadSearchSnapshot('owner', filters, '', async () => [job]);
  assert.equal(
    (await unavailable.loadSearchSnapshot('owner', empty, '', async () => [])).restored,
    true
  );
});

test('a slower old search cannot replace the latest search in the cache', async () => {
  const store = storage(),
    cache = session(store);
  let resolve;
  const old = cache.loadSearchSnapshot(
    'owner',
    filters,
    'old',
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const newerFilters = { ...filters, titleOnly: 'Data Scientist' };
  await cache.loadSearchSnapshot('owner', newerFilters, 'new', async () => [
    { ...job, jobId: 'newer' },
  ]);
  resolve([job]);
  await old;
  const restored = await session(store).loadSearchSnapshot('owner', empty, '', async () => {
    throw Error('Must not search');
  });
  assert.equal(restored.snapshot.jobs[0].jobId, 'newer');
});

test('a late request with identical parameters cannot overwrite newer results', async () => {
  const cache = session(storage());
  let resolve;
  const old = cache.loadSearchSnapshot(
    'owner',
    filters,
    'old',
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  await cache.loadSearchSnapshot('owner', filters, 'new', async () => [{ ...job, jobId: 'newer' }]);
  resolve([job]);
  await old;
  const restored = await cache.loadSearchSnapshot('owner', filters, 'old', async () => {
    throw Error('Must not search');
  });
  assert.equal(restored.snapshot.jobs[0].jobId, 'newer');
});

test('blank Search submission does not accidentally restore an unrelated query', async () => {
  const cache = session(storage());
  let calls = 0;
  await cache.loadSearchSnapshot('owner', filters, '', async () => [job]);
  const result = await cache.loadSearchSnapshot('owner', empty, 'blank-submit', async () => {
    calls++;
    return [];
  });
  assert.equal(calls, 1);
  assert.deepEqual(plain(result.snapshot.filters), empty);
});

test('saved/comparison metadata refresh preserves search order and description', () => {
  const cache = session(storage());
  const result = cache.mergeSavedSearchJobs(
    [job, { ...job, jobId: 'removed', saved: true, matchScore: 80 }],
    [
      {
        ...job,
        saved: true,
        comparisonStatus: 'COMPLETED',
        matchScore: 90,
        jobDescription: 'Saved text',
      },
    ]
  );
  assert.equal(result[0].matchScore, 90);
  assert.equal(result[0].jobDescription, job.jobDescription);
  assert.equal(result[1].saved, false);
  assert.equal(result[1].matchScore, null);
});

test('server Search page never calls the job-search API during navigation', async () => {
  const paths = [];
  const { default: page } = load('src/app/dashboard/search-results/page.tsx', {
    'next/dist/client/components/redirect-error': { isRedirectError: () => false },
    '@/components/search-results/search-results-container': { default: () => null },
    '@/lib/job-search': jobSearch,
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'private-login-token' }) }) },
    'node:crypto': { createHash },
    'next/navigation': {
      redirect: () => {
        throw Error('Unexpected redirect');
      },
    },
    '@/lib/server-api-client': {
      serverApiFetch: async (path) => {
        paths.push(path);
        return { resumeId: 'resume' };
      },
    },
    'react/jsx-runtime': { jsx: (component, props) => ({ props }) },
  });
  const result = await page({ searchParams: Promise.resolve({}) });
  assert.deepEqual(paths, ['/users/me']);
  assert.equal(result.props.currentResumeId, 'resume');
  assert.notEqual(result.props.cacheScope, 'private-login-token');
});
