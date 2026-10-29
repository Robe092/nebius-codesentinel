import type OpenAI from "openai";
import { TokenUsage } from "@/types";

export interface BoundedInferenceBudget {
  maxRequests: number;
  requestsUsed: number;
}

export interface BoundedInferenceOptions {
  client: OpenAI;
  model: string;
  fallbackModel?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  budget: BoundedInferenceBudget;
  maxPayloadBytes?: number;
}

export interface BoundedInferenceResult {
  id?: string;
  model?: string;
  requestedModel: string;
  content: string;
  usage?: TokenUsage;
  latencyMs: number;
}

const DEFAULT_MAX_TOKENS = 4000;
const DEFAULT_MAX_PAYLOAD_BYTES = 8192;

/**
 * Shared bounded inference helper with explicit byte limits, request budgets,
 * token bounds, and strict error transparency (zero silent fallbacks).
 */
export async function executeBoundedInference(
  options: BoundedInferenceOptions
): Promise<BoundedInferenceResult> {
  const maxPayload = options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES;
  const serialized = JSON.stringify(options.messages);
  const payloadBytes = Buffer.byteLength(serialized, "utf8");

  if (payloadBytes > maxPayload) {
    throw new Error(
      `Inference payload exceeds limit: serialized messages length is ${payloadBytes} bytes (maximum allowed: ${maxPayload} bytes)`
    );
  }

  if (options.budget.requestsUsed >= options.budget.maxRequests) {
    throw new Error(
      `Inference budget exhausted: ${options.budget.requestsUsed}/${options.budget.maxRequests} requests already consumed for this run`
    );
  }

  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const start = Date.now();

  try {
    options.budget.requestsUsed++;
    const response = await options.client.chat.completions.create({
      model: options.model,
      messages: options.messages as any,
      max_tokens: maxTokens,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const choice = response.choices?.[0];
    if (choice?.finish_reason === "length") {
      throw new Error(`Model response was truncated due to token limit (${maxTokens} tokens)`);
    }

    const content = choice?.message?.content?.trim();
    if (!content) {
      throw new Error("Empty response received from model endpoint");
    }

    const usage: TokenUsage | undefined = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined;

    return {
      id: response.id || undefined,
      model: response.model || undefined,
      requestedModel: options.model,
      content,
      usage,
      latencyMs: Date.now() - start,
    };
  } catch (primaryErr: any) {
    // If primary failed and fallbackModel is available with remaining budget, attempt fallback
    if (
      options.fallbackModel &&
      options.budget.requestsUsed < options.budget.maxRequests
    ) {
      try {
        options.budget.requestsUsed++;
        const fallbackResponse = await options.client.chat.completions.create({
          model: options.fallbackModel,
          messages: options.messages as any,
          max_tokens: maxTokens,
          temperature: 0.1,
          response_format: { type: "json_object" },
        });

        const choice = fallbackResponse.choices?.[0];
        if (choice?.finish_reason === "length") {
          throw new Error(`Fallback model response was truncated due to token limit (${maxTokens} tokens)`);
        }

        const content = choice?.message?.content?.trim();
        if (!content) {
          throw new Error("Empty response received from fallback model endpoint");
        }

        const usage: TokenUsage | undefined = fallbackResponse.usage
          ? {
              promptTokens: fallbackResponse.usage.prompt_tokens,
              completionTokens: fallbackResponse.usage.completion_tokens,
              totalTokens: fallbackResponse.usage.total_tokens,
            }
          : undefined;

        return {
          id: fallbackResponse.id || undefined,
          model: fallbackResponse.model || undefined,
          requestedModel: options.fallbackModel || options.model,
          content,
          usage,
          latencyMs: Date.now() - start,
        };
      } catch (fallbackErr: any) {
        throw new Error(
          `Primary model failed (${primaryErr.message}) and fallback model also failed: ${fallbackErr.message}`
        );
      }
    }

    // Re-throw explicit primary failure: no silent simulation replacement allowed
    throw primaryErr;
  }
}
