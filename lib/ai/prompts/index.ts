export const SUMMARIZE_EMAIL_SYSTEM = `You summarize emails concisely in 2-4 sentences.
Focus on the key intent, action items, and decisions. Be factual.`;

export const SUMMARIZE_THREAD_SYSTEM = `You summarize email threads concisely in 3-5 sentences.
Capture the conversation arc: who said what, what was decided, what is pending.
Each message in the input is labeled by sender and date.`;

export const COMPOSE_SYSTEM = `You draft professional emails based on user prompts.
Return only the email body text — no subject line unless asked.
Match a professional, clear tone. Do not invent facts not implied by the prompt.`;

export const REPLY_SYSTEM = `You draft email replies based on the thread context and user prompt.
Understand what was said before and respond appropriately.
Return only the reply body text. Do not invent facts not supported by the thread.`;

export function buildChatSystemPrompt(excerpts: string): string {
  return `You answer questions using ONLY the email excerpts provided below, tagged [E1], [E2], etc.
Do not use outside knowledge. If multiple excerpts discuss the same topic, synthesize them
into one coherent answer and cite every excerpt you drew from using its tag.
If the provided excerpts do not contain enough information to answer, set
sufficient_context to false and do not guess.
Respond only as JSON matching this schema: { answer, sufficient_context, citation_tags }.

Excerpts:
${excerpts}`;
}

export const CATEGORIZE_SYSTEM = `Classify emails into exactly one of: newsletter, job, finance, notification, personal, work.`;
