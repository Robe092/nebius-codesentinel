export const WORKSPACE_SAMPLES = [
  {
    title: "Payment webhook",
    description: "Secrets, approvals & expressions",
    filename: "payment_webhook.ts",
    code: `// Payment webhook · automation workspace
import { dispatchSlackAlert } from "./notifier";

const STRIPE_SECRET = "sk-live_98372498237498237498234";

export async function handlePayment(event: any) {
  const amount = event.data.amount;
  const customerEmail = json.customer.email;

  if (amount > 10000) {
    await dispatchSlackAlert({
      channel: "#high-value-transactions",
      text: "High payment processed: " + amount,
    });
  }

  return {
    status: "processed",
    email: customerEmail,
  };
}
`,
  },
  {
    title: "Data transformation",
    description: "An expression that needs attention",
    filename: "data_transform.ts",
    code: `// Data transformation · n8n expression context
export function transformPayload(items: any[]) {
  return items.map((item) => {
    const title = json.user.profile.title;
    return { title, source: item.id };
  });
}
`,
  },
  {
    title: "Guarded service",
    description: "A clean example for comparison",
    filename: "secure_service.ts",
    code: `// Guarded service · automation workspace
const API_TOKEN = process.env.SERVICE_TOKEN || "";

export async function processSecureBatch(items: any[]) {
  const data = $json.records;

  if (await verifyHumanApproval(data)) {
    return { success: true, processed: data.length };
  }

  throw new Error("Human approval required");
}
`,
  },
];
