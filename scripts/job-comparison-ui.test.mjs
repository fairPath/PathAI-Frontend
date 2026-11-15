import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';

function load(file, mocks) {
  const source = ts.transpileModule(
    fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'),
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
      assert.ok(name in mocks, 'Unexpected import: ' + name);
      return mocks[name];
    },
    Intl,
  });
  return exports;
}
const helpers = load('src/lib/job-comparison.ts', {});
const Button = ({ children, ...props }) => {
  delete props.asChild;
  return React.createElement('button', props, children);
};
const Container = ({ children, ...props }) => React.createElement('div', props, children);
const JobDescription = load('src/components/search-results/job-description.tsx', {
  react: React,
  'react/jsx-runtime': jsxRuntime,
  'lucide-react': { Star: () => React.createElement('span', null, 'star') },
  sonner: { toast: {} },
  '@/components/ui/button': { Button },
  '@/components/ui/card': { Card: Container, CardContent: Container },
  '@/app/dashboard/search-results/action': { requestJobComparison() {} },
  '@/lib/job-comparison': helpers,
}).default;
const job = {
  jobId: 'job',
  title: 'Engineer',
  companyName: 'Example',
  dateCreated: '2026-11-01',
  jobDescription: 'Synthetic job',
  location: 'Remote',
  redirectUrl: 'https://example.invalid/job',
  salaryMin: 100,
  salaryMax: 100,
  saved: true,
  matchScore: null,
  comparisonStatus: 'NOT_REQUESTED',
};
function render(overrides = {}, props = {}) {
  return renderToStaticMarkup(
    React.createElement(JobDescription, {
      job: { ...job, ...overrides },
      currentResumeId: 'resume',
      enableComparison: true,
      isSaving: false,
      onToggleSaved: async () => {},
      ...props,
    })
  );
}
test('saved details replace the header star with Check match', () => {
  const html = render();
  assert.match(html, /Check match<\/button>/);
  assert.doesNotMatch(html, /aria-label="Save job"/);
  assert.doesNotMatch(html, /Remove saved job/);
});
test('unsaved details retain a save control', () => {
  assert.match(render({ saved: false }), /aria-label="Save job"/);
});
test('a permanent failure disables Retry match and explains it below the button', () => {
  const html = render(
    {
      comparisonStatus: 'FAILED',
      comparisonErrorCode: 'AI_AUTHENTICATION_FAILED',
      comparisonRetryable: false,
    },
    { comparisonBlocked: true }
  );
  assert.match(html, /disabled=""[^>]*>Retry match<\/button>/);
  assert.match(html, /role="alert"/);
  assert.ok(
    html.indexOf('Retry match</button>') < html.indexOf('Match checks are temporarily unavailable')
  );
  assert.match(html, /Refresh the page/);
  assert.doesNotMatch(html, /sign in|log in/i);
});
test('after a page refresh a stored permanent failure allows a deliberate retry', () => {
  const html = render({
    comparisonStatus: 'FAILED',
    comparisonErrorCode: 'AI_AUTHENTICATION_FAILED',
    comparisonRetryable: false,
  });
  assert.match(html, /Retry match<\/button>/);
  assert.doesNotMatch(html, /disabled=""[^>]*>Retry match/);
});
test('pending comparisons disable the header button', () => {
  assert.match(render({ comparisonStatus: 'PENDING' }), /disabled=""[^>]*>Checking…<\/button>/);
});

for (const comparisonStatus of ['NOT_REQUESTED', 'PENDING', 'FAILED', 'COMPLETED']) {
  test('Search retains the star and hides match actions for ' + comparisonStatus, () => {
    const html = render({ comparisonStatus }, { enableComparison: false });
    assert.match(html, /aria-label="Remove saved job"/);
    assert.doesNotMatch(html, />(Check match|Retry match|Check match again|Checking…)<\/button>/);
  });
}

test('total and brief advice appear above the skill and experience score sections', () => {
  const html = render({
    comparisonStatus: 'COMPLETED',
    matchScore: 85,
    skillMatchScore: 90,
    experienceMatchScore: 80,
    resumeAdvice: 'Highlight your relevant projects. Clarify your demonstrated impact.',
    matchedSkills: ['Python'],
    missingSkills: ['Java'],
    relevantExperience: 'Delivered backend services',
  });
  assert.match(html, /85%/);
  assert.match(html, /90%/);
  assert.match(html, /80%/);
  assert.ok(html.indexOf('aria-label="Total match"') < html.indexOf('aria-label="Skill match"'));
  assert.ok(
    html.indexOf('Before you apply') < html.indexOf('aria-label="Relevant experience match"')
  );
  assert.match(html, /Highlight your relevant projects/);
});

test('zero component scores remain visible', () => {
  const html = render({
    comparisonStatus: 'COMPLETED',
    matchScore: 0,
    skillMatchScore: 0,
    experienceMatchScore: 0,
    resumeAdvice: 'Highlight any relevant projects you have completed.',
  });
  assert.equal((html.match(/>0%</g) ?? []).length, 3);
});

test('Search failure directs users to Saved Jobs without exposing comparison buttons', () => {
  const html = render({ comparisonStatus: 'FAILED' }, { enableComparison: false });
  assert.match(html, /Match check failed. Open Saved Jobs to retry./);
  assert.match(html, /aria-label="Remove saved job"/);
  assert.doesNotMatch(html, />(Check match|Retry match|Check match again|Checking…)<\/button>/);
  assert.doesNotMatch(html, /Select Retry match/);
});
