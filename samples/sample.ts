// Sample Vulnerable Workflow for Nebius CodeSentinel Demo
import { dispatchSlackAlert } from "./notifier";

// Security Invariant Violation: Hardcoded API Secret
const STRIPE_SECRET = "sk-live_98372498237498237498234";

export async function handlePayment(event: any) {
  const amount = event.data.amount;
  // Syntax Anomaly: Missing leading '$' in n8n expression reference
  const customerEmail = json.customer.email;

  if (amount > 10000) {
    // Governance Violation: Unguarded external communication dispatch without HITL gatekeeper
    await dispatchSlackAlert({
      channel: "#high-value-transactions",
      text: "High payment processed: " + amount,
    });
  }

  return { status: "processed", email: customerEmail };
}
