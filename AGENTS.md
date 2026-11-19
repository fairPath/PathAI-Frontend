# Agent instructions

## Rules

Read `RULES.md` from `fairPath/fairpath-rules` before starting any ticket or implementation. Every change in this repo follows it.

- With the rules repo cloned next to this one: `../fairpath-rules/RULES.md`
- Otherwise: `gh api repos/fairPath/fairpath-rules/contents/RULES.md -H "Accept: application/vnd.github.raw"`

The rules repo is private. If neither works, ask the developer for access before writing code.

## Required frontend reuse

Before writing any functionality, check `src/lib/utils.ts` for an existing utility that does the same or similar work. Reuse it when it covers the need. If it needs to support a new caller, extend it while preserving behavior for existing callers.

You must reuse the following files when implementing the behavior they cover. Do not recreate their functionality in a new component, helper, client, or type.

- Every file in `src/components/ui/`. Use `src/components/ui/button.tsx` for buttons and `src/components/ui/skeleton.tsx` for loading placeholders.
- `src/components/shared/SplitText.tsx` for split-text animations.
- `src/types/action-result.ts` for shared server action results.
- `src/lib/server-api-client.ts` for authenticated server-side Spring requests.
- `src/lib/fetch-response.ts` for extracting errors from raw HTTP responses.
- `src/lib/ai-api-client.ts` for AI-backed Spring requests and success response decoding.
- `src/lib/ai-request.ts` for running AI actions and handling request failures.
- `src/lib/ai-errors.ts` for AI result types, error parsing, and retry behavior.
- `src/lib/analysis-errors.ts` for resume and analysis failure messages and retry timing.

### Backward compatibility

When extending any reusable file, preserve existing behavior for all current callers. Make new parameters and props optional for existing callers. Omitting them or passing `null` or `undefined` must preserve the previous behavior without throwing, breaking existing functionality, or crashing a page. Verify existing call sites and these missing-value cases before merging.

## Done

Done means `npm run lint` and `npm run format:check` pass. CI runs the same two on every PR.
