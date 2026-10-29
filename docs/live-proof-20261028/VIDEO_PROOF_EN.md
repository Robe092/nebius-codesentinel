# Recorded live repair — NVIDIA on Nebius

**This is a saved real API response from 28 October 2026. Viewing this document makes no new API request.**

| Evidence | Observed value |
| --- | --- |
| Model | `nvidia/nemotron-3-super-120b-a12b` |
| Provider response ID | `chatcmpl-aa293e018d7955bb` |
| Generation requests | **1**; no fallback or automatic retry |
| Usage | **143 input + 736 output = 879 tokens** |
| Duration of this request | **6.683 seconds**; not a benchmark |
| Estimated inference cost | **$0.0007053 before tax**, based on the observed prices and returned usage |
| Checks | **PASS: static rules, semantic TypeScript, controlled fixture structure** |
| Runtime / business execution | **NOT_VERIFIED — returned code was not executed** |

## Actual returned repair

```typescript
// Payment webhook invariant test fixture
const STRIPE_SECRET = process.env.API_CREDENTIAL;
export async function handlePayment(event: any) {
  return { status: "processed", email: event.customer?.email };
}
```

## Actual returned diff

```diff
- const STRIPE_SECRET = "DEMO_ONLY_NOT_A_REAL_CREDENTIAL";
+ const STRIPE_SECRET = process.env.API_CREDENTIAL;
```

The input used an explicitly fictitious `DEMO_ONLY_NOT_A_REAL_CREDENTIAL` placeholder, not a real credential. The Nebius API key was used only for authentication and is absent from the model prompt and saved evidence.

The workspace demonstration is separately labelled `MOCK_SIMULATED`. Its simulated repairs are not presented as this live response. Source evidence: `LIVE_NEBIUS_PROBE.json`, `MODEL_RESPONSE_1.json` and `REQUEST_BUDGET.json` in this directory.
