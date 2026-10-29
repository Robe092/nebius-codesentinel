// Sample workflow for CodeSentinel's static and TypeScript fixture environment.
// The host must provide approval, input and notifier implementations at runtime.
import { dispatchSlackAlert } from "./notifier";

// Invariant Compliant: Environment variable
const STRIPE_SECRET = process.env.STRIPE_SECRET || "";

export async function handlePayment(event: any) {
  const amount = event.data.amount;
  // Invariant Compliant: Valid $json reference
  const customerEmail = $json.customer.email;

  if (amount > 10000) {
    // Invariant Compliant: Guarded by Human-in-the-Loop gatekeeper
    if (await verifyHumanApproval(event)) {
      await dispatchSlackAlert({
        channel: "#high-value-transactions",
        text: "Approved high payment: " + amount,
      });
    }
  }

  return { status: "processed", email: customerEmail };
}
