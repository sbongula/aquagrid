// Copy to config.js and paste your key:  cp src/config.example.js src/config.js
// config.js is gitignored. The key lives client-side by design - this is a
// demo with no backend, and the README says so explicitly.
export const GROQ_API_KEY = '';
// Open-weight. Verified live on the free tier; llama-3.3-70b is decommissioned.
export const GROQ_MODEL = 'openai/gpt-oss-120b';
export const GROQ_MODEL_FALLBACK = 'groq/compound-mini';
export const GROQ_MODEL_LABEL = 'GPT-OSS 120B';
