import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { CategoryOption } from "@/lib/quick-add/categorize";
import type { TxType } from "@/lib/quick-add/parse";

const MODEL = "claude-haiku-5-5";

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
}

/**
 * Pide a Claude que elija una categoría para una descripción que las reglas
 * no reconocieron. Si no hay API key, la llamada falla o tarda más de 4s,
 * devuelve null y el movimiento queda en "Otros": registrar nunca se bloquea.
 */
export async function suggestCategory(
  description: string,
  type: TxType,
  categories: CategoryOption[],
): Promise<string | null> {
  const anthropic = getClient();
  const options = categories.filter((c) => c.type === type);
  if (!anthropic || !description.trim() || options.length === 0) return null;

  const names = options.map((c) => c.name);
  const Schema = z.object({ category: z.enum(names as [string, ...string[]]) });

  try {
    const response = await anthropic.messages.parse(
      {
        model: MODEL,
        max_tokens: 256,
        thinking: { type: "disabled" },
        output_config: { effort: "low", format: zodOutputFormat(Schema) },
        system:
          "Clasificas movimientos de finanzas personales de una persona en Colombia. " +
          "Responde con la categoría que mejor describe el movimiento. " +
          "Si ninguna encaja, usa \"Otros\".",
        messages: [
          {
            role: "user",
            content: `${type === "expense" ? "Gasto" : "Ingreso"}: ${description}`,
          },
        ],
      },
      { timeout: 4_000, maxRetries: 0 },
    );
    const name = response.parsed_output?.category;
    return options.find((c) => c.name === name)?.id ?? null;
  } catch (error) {
    console.error("suggestCategory falló:", error);
    return null;
  }
}
