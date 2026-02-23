type DenoLike = {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

const deno = (globalThis as unknown as { Deno?: DenoLike }).Deno;

if (!deno) {
  throw new Error("Deno runtime not available");
}

deno.serve(async (req: Request) => {
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const botToken = deno.env.get("TELEGRAM_BOT_TOKEN_ML_FOTOGRAFIA");
  const chatId = deno.env.get("TELEGRAM_CHAT_ID_ML_FOTOGRAFIA");
  if (!botToken || !chatId) {
    return new Response(JSON.stringify({ error: "Missing Telegram configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }

  const text =
    typeof payload === "object" && payload !== null && "text" in payload
      ? String((payload as Record<string, unknown>).text)
      : "";

  if (!text.trim()) {
    return new Response(JSON.stringify({ error: "Missing message text" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!telegramRes.ok) {
    const details = await telegramRes.text();
    return new Response(JSON.stringify({ error: "Telegram error", details }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(null, { status: 204, headers: corsHeaders });
});
