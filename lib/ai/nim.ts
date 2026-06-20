import { EMBED_DIM, NIM_MAX_INPUT_CHARS, NVIDIA_EMBED_MODEL } from "@/lib/ai/models";

const BASE_URL =
  process.env.NVIDIA_NIM_BASE_URL ?? "https://integrate.api.nvidia.com/v1";

/** nv-embedqa-e5-v5 is asymmetric: use "passage" for stored email chunks, "query" for search questions. */
export type NimInputType = "passage" | "query";

async function embedWithType(
  text: string,
  inputType: NimInputType
): Promise<number[]> {
  const apiKey = process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_NIM_API_KEY is not set");

  const response = await fetch(`${BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: NVIDIA_EMBED_MODEL,
      input: [text.slice(0, NIM_MAX_INPUT_CHARS)],
      input_type: inputType,
      encoding_format: "float",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`NIM embedding failed: ${response.status} ${err}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };

  const embedding = data.data[0]?.embedding;
  if (!embedding || embedding.length !== EMBED_DIM) {
    throw new Error(
      `Unexpected embedding dimension: got ${embedding?.length}, expected ${EMBED_DIM}`
    );
  }

  return embedding;
}

/** Embed email content for storage / indexing. */
export async function embedPassage(text: string): Promise<number[]> {
  return embedWithType(text, "passage");
}

/** Embed a user search question for retrieval. */
export async function embedQuery(text: string): Promise<number[]> {
  return embedWithType(text, "query");
}

/** @deprecated Use embedPassage or embedQuery — asymmetric model requires input_type. */
export async function embedText(text: string): Promise<number[]> {
  return embedPassage(text);
}

export async function embedTexts(
  texts: string[],
  inputType: NimInputType = "passage"
): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await embedWithType(text, inputType));
    await new Promise((r) => setTimeout(r, 100));
  }
  return results;
}
