export const env = {
  openaiKey: process.env.OPENAI_API_KEY || "",
  geminiKey: process.env.GEMINI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-6-astra",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  cronSecret: process.env.CRON_SECRET || "",
  demoMode: process.env.DEMO_MODE === "1",
};

export function providerStatus() {
  return {
    openai: !!env.openaiKey,
    gemini: !!env.geminiKey,
    demo: env.demoMode || (!env.openaiKey && !env.geminiKey),
  };
}

export function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }));
}
