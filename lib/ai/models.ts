/** Single source of truth for AI model identifiers. Update here if a model ID changes. */

export const GEMINI_MODEL = "gemini-3.1-flash-lite";

export const NVIDIA_EMBED_MODEL = "nvidia/nv-embedqa-e5-v5";

export const EMBED_DIM = 1024;

export const RAG_TOP_K = 10;

export const CHUNK_SIZE_CHARS = 1200;

export const CHUNK_OVERLAP_CHARS = 100;

/** NIM nv-embedqa-e5-v5 max is 512 tokens — keep inputs under ~1500 chars to be safe. */
export const NIM_MAX_INPUT_CHARS = 1500;

export const AI_TEMPERATURE = 0.2;
