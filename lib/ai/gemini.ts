import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { AI_TEMPERATURE, GEMINI_MODEL } from "@/lib/ai/models";

let client: GoogleGenerativeAI | null = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenerativeAI(apiKey);
  }
  return client;
}

export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  temperature = AI_TEMPERATURE
): Promise<string> {
  const model = getClient().getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
    generationConfig: { temperature },
  });

  const result = await model.generateContent(userPrompt);
  return result.response.text();
}

export interface ChatAgentResponse {
  answer: string;
  sufficient_context: boolean;
  citation_tags: string[];
}

export async function generateStructuredChatResponse(
  systemPrompt: string,
  userPrompt: string
): Promise<ChatAgentResponse> {
  const model = getClient().getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: AI_TEMPERATURE,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          answer: { type: SchemaType.STRING },
          sufficient_context: { type: SchemaType.BOOLEAN },
          citation_tags: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
        },
        required: ["answer", "sufficient_context", "citation_tags"],
      },
    },
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  return JSON.parse(text) as ChatAgentResponse;
}

export interface CategoryResult {
  category: string;
  confidence: number;
}

export async function classifyEmail(
  subject: string,
  body: string,
  from: string
): Promise<CategoryResult> {
  const model = getClient().getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          category: { type: SchemaType.STRING },
          confidence: { type: SchemaType.NUMBER },
        },
        required: ["category", "confidence"],
      },
    },
  });

  const prompt = `Classify this email into exactly one category: newsletter, job, finance, notification, personal, work.

From: ${from}
Subject: ${subject}
Body preview: ${body.slice(0, 1500)}`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as CategoryResult;
}
