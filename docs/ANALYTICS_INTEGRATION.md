# Proposed analytics integration

Status: proposed. Nothing in this document is built. Fieldwork ships one analytics provider, `SyntheticAnalyticsProvider`, which loads a bundled fixture with no credentials and no network request.

This note describes what a later `EnterpriseAnalyticsProvider` would have to do. It is based on the two documentation pages read on 2026-11-25 (see `EVIDENCE.md`). It has not been checked against a live tenant, and the documentation should be re-read before any work starts.

## Who authorizes it

The customer does. According to the Analytics APIs page, only the primary owner of a Claude Enterprise organization can enable API access and create an Analytics API key, and that key carries the `read:analytics` scope. A seller does not have this access by default.

Sharing employee-level data with an account team is the customer's decision. The integration should not exist for an account until the customer has approved it in writing, including which groups and which fields are shared.

## Where the credential lives

In a tenant-isolated backend, never in the browser. One customer's key must not be able to read another customer's data, and the frontend should only ever receive normalized observations.

An Analytics API key is a different thing from a general Claude API key. The adapter must not accept one in place of the other, and the app must never ask a visitor to paste an organization key into a form.

## What the adapter does

The provider interface is already in `src/providers/analytics.ts`: `load()` returns an `AnalyticsSnapshot` in Fieldwork's own schema. A real adapter would fill that shape from permitted data.

1. Request per-member activity for a date window from the user activity endpoint, following the request format in the reference that is current at build time.
2. Normalize each row into Fieldwork's `MemberRecord`. Project and Skill use become booleans derived from the documented counts. A `null` in the source stays `null`. It is never turned into `false` or `0`.
3. Record the source, the window, the product and the coverage on every observation, as `UsageObservation` already requires.
4. Deduplicate members before counting. Rows grouped by RBAC group are not an exclusive partition, so group totals can exceed the organization total.
5. Never add daily distinct counts to get a weekly or monthly figure. Use the endpoint's date-range mode, and treat approximate distinct counts as approximate.
6. Handle the data lag. Engagement data for a day usually arrives the next day, and values can be revised afterwards. Show the snapshot date and do not present the latest day as final.
7. Account for Chat and Cowork unified. Most of that activity is reported under its own product value, so a filter on chat alone can undercount.

## Capability state

The eligibility rule in `src/rules/analytics.ts` depends on knowing whether Projects and Skills are available to a member. The two pages read during the build do not show a field for that. Until a documented source is confirmed, capability state has to come from the customer's admin or sponsor and be recorded with its own provenance.

The rule is already conservative about this. A restricted capability or an unknown value never matches the pattern, so missing capability data leads to "check access first" and never to a skills diagnosis.

## What must not be built

- A connector that appears to work but returns invented data.
- Any scraping of an admin dashboard.
- Any field name that is not in the documentation.
- A path that sends employee-level data to a model without the customer's approval.

## Other evidence streams

Survey responses can be exported from the product as a CSV. That export includes each respondent's email and group, so it is identifiable data and should not be described as anonymous. The article read on 2026-11-25 does not describe a survey API. Raw conversation content is not needed for anything Fieldwork does.

Usage metrics, survey responses, CRM context, practice scores and recommendations should each keep their own provenance in the schema. They answer different questions and should not be merged into one score.
