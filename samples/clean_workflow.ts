// Sample Compliant Production Workflow for Nebius CodeSentinel
import { dispatchSlackAlert } from "./notifier";
import { hitlGatekeeper } from "./guardrails";

// Invariant Compliant: Environment variable
const STRIPE_SECRET = process.env.STRIPE_SECRET || "";

export async function handlePayment(event: any) {
  const amount = event.data.amount;
  // Invariant Compliant: Valid $json reference
  const customerEmail = $json.customer.email;

  if (amount > 10000) {
    // Invariant Compliant: Guarded by Human-in-the-Loop gatekeeper
    if (await hitlGatekeeper.approve({ amount, customerEmail })) {
      await dispatchSlackAlert({
        channel: "#high-value-transactions",
        text: "Approved high payment: " + amount,
      });
    }
  }

  return { status: "processed", email: customerEmail };
}
