# Pre-beta defect repair

Base reviewed revision: `2bfdb1179a92576e6de9fe9e6ebf143f48ba75e8`, existing draft PR #7. Working tree was clean and the local/remote branch matched before changes. This repair preserves the approved visuals, model calculations, schemas, RLS and authorization.

## Reproductions before the fix

Real XLSX ZIP workbooks, derived from the existing binary fixture and regenerated with valid ZIP directories, contained numeric cell values `12 units`, `1e` and `0x10`. The unchanged importer returned 12, 1 and 0 respectively. All three new rejection tests failed with “Missing expected rejection.” Numeric values are lost before normal validation because ExcelJS uses permissive conversion.

An export with `evaluation.warnings: []`, `evaluation.context: {}` and `evaluation.unavailable: null` retained only the null row; both empty containers disappeared. The new typed export regression failed on the unchanged implementation.

The browser race reproduction used a real successful import POST, held Workspace A's subsequent refresh response, cancelled the dialog, switched A → B → A → B, opened another dialog and released the old response. The old continuation closed the new dialog. The regression failed waiting for that dialog to remain visible. No arbitrary sleep or mocked component function was used.

Original local evidence is retained in `.data/pre-beta/reproduction-before.json`, `unit-before.log`, `race-before.log`, `race-before-trace.zip` and the three actual `malformed-*.xlsx` archives. These are local test fixtures and traces, not customer data.

## Changes

### XLSX numeric boundary

The existing bounded SAX/ZIP preflight now validates numeric `<v>` content in cells with omitted type or `t="n"`, before ExcelJS runs. It requires a complete finite signed decimal/scientific representation; hexadecimal/binary, partial exponents, trailing units, empty/nonfinite values and nested elements are rejected. XML numeric whitespace remains insignificant. Date serials use the same numeric grammar and keep the existing epoch/date-only validation. Formula rejection, expansion/row/column/XML budgets remain; numeric lexical content also has a 2,048-character bound. No formula is evaluated and malformed values are never repaired.

Regression cases generate actual workbook bytes and exercise both explicit/implicit numeric types. Valid signed decimals, exponents and existing 1900/1904 date tests remain covered.

### Import lifecycle

The import controller now owns the operation through response decoding and the workspace refresh callback. Cancellation aborts it synchronously; unmount aborts it too, and workspace identity keys the onboarding instance. The workspace callback checks the signal and workspace before refresh and again before changing selection, messages, result state or tabs. The child checks ownership after each asynchronous boundary and cannot close a newly opened dialog after an obsolete callback.

Deterministic browser cases hold preview, import and refresh responses, exercise rapid switching, and separately cancel/reopen within the same workspace. Existing successful-import, error recovery and immutable-in-flight settings tests remain in the suite. Cancelling a browser operation does not roll back a POST already committed on the server; its dataset remains in its authorized workspace.

### Export serialization contract v2

CSV and every XLSX sheet retain the first eight columns and append column nine, `metadata_type`. Metadata declares `export_version = "2"`. Observation/forecast rows leave metadata columns blank. Forecast values, native quantiles and timestamps are unchanged.

| Persisted JSON value | metadata_value | metadata_type |
| --- | --- | --- |
| Empty array | `[]` | `array` |
| Empty object | `{}` | `object` |
| Nonempty container | empty text, followed by child rows | `array` or `object` |
| Null | `null` | `null` |
| String, including literal `[]`, `{}` or `null` | its text | `string` |
| Number | numeric cell in XLSX, canonical decimal text in CSV | `number` |
| Boolean | `true` or `false` | `boolean` |
| Missing field | no row | no row |

Paths retain dot-separated property names and zero-based array indices. A literal backslash in a property is escaped as `\\`; a literal dot is escaped as `\.`. Container type rows distinguish arrays from objects with numeric keys. The contract covers persisted JSON, which cannot contain JavaScript `undefined`, sparse arrays or nonfinite numbers. CSV quoting/formula-text neutralization remains in force; numeric cells remain numeric. Consumers must check the export version/type column rather than infer JSON types from text.

Unit assertions distinguish null/containers/literal strings, preserve nested values and test escaped keys. An authorized API test reads actual PostgreSQL-persisted metadata and verifies both CSV and real XLSX exports, including numeric precision and timestamps. The genuine Timestral CSV/XLSX tests still compare every history value, forecast, native quantile and metadata field against saved PostgreSQL records, now including the explicit type/container rows.

## Local regression evidence

- `npm run verify`: all 13 checks passed, including production build, lint, format, typecheck, dependency consistency and advisory checks.
- Full Node suite: **66 passed, zero failed/skipped**, including embedded/PostgreSQL tenant-isolation and worker job tests. Verification used a temporary isolated PostgreSQL database, removed afterwards.
- Full Python suite: **55 passed, zero failed/skipped**, with real PostgreSQL and genuine Timestral integration enabled on CPU. Forecast algorithms were unchanged.
- Hallmark verification infrastructure: **20 gate/parser and 12 installer tests passed**, including negative render/integrity cases.
- Full Chromium suite: **57 passed, zero failed/skipped**. Includes six new defect cases, the actual Timestral CSV/XLSX import → asynchronous worker → persisted native quantiles → authorized retrieval/export flows, RLS/API regression cases, all six existing desktop/tablet/mobile snapshots without baseline changes, keyboard and reduced-motion/WebGL checks.
- Hallmark static regression: **zero new findings, 44 existing findings retained**. Rendered audit executed **4/4 required targets** and checked 20 PNGs using Chromium's supported platform sandbox; raw findings remain visible. This is not a raw Hallmark clean pass.

Evidence: [original accepted numeric values and missing containers](pre-beta-evidence/reproduction-before.json), [machine-readable source checks](pre-beta-evidence/local-checks.json), and [local evidence manifest](pre-beta-evidence/local-evidence.json). Full local logs/traces/PNG files are under `.data/pre-beta/`, `.data/checks/`, `.data/hallmark/render-lVFBGK/` and the run directory identified in that manifest. Only disposable QA accounts/data were used. Existing historical design screenshot folders were restored to their original milestone files after retaining the newly generated captures under `.data/pre-beta/`.

The PyPI advisory audit cannot audit the pinned Timestral Git-source package; this is reported explicitly rather than claimed as covered. No new dependency was introduced. CSV/XLSX consumers must honor export v2; cancellation cannot undo an already committed server import. Calibration/field performance limitations are unchanged.

Changed implementation: `apps/web/lib/dataset-import.ts`, `apps/web/lib/forecast-export.ts`, `apps/web/components/onboarding/DataOnboarding.tsx`, `apps/web/components/workspace.tsx`. Regression coverage: `apps/web/tests/onboarding.test.ts`, `apps/web/tests/forecast-export.test.ts`, `e2e/pre-beta.spec.ts`, and the complete persisted-record comparison in `e2e/timestral.spec.ts`. Documentation records export v2 and supersedes the historical unresolved-defect note. No schema, RLS, worker, algorithm or visual baseline file changed.

## Independent review

No database/API authorization rule, forecasting algorithm, payment service, production deployment or merge changed. The three prior review findings documented in the visual milestone are superseded by this repair. Independent Claude review is still required; passing automation is not an independent acceptance verdict.
