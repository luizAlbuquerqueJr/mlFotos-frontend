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

function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("forwarded");
  if (forwarded) {
    const match = forwarded.match(/for=(?:"?)(\[[^\]]+\]|[^;,"]+)/i);
    if (match?.[1]) {
      const parsed = sanitizeIp(match[1]);
      if (parsed) return parsed;
    }
  }

  const raw =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip");

  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  return first ? sanitizeIp(first) : null;
}

function getForwardedForChain(req: Request): string[] {
  const xff = req.headers.get("x-forwarded-for");
  const fromXff = !xff
    ? []
    : xff
    .split(",")
    .map((s) => sanitizeIp(s.trim()))
    .filter(Boolean);

  const forwarded = req.headers.get("forwarded");
  const fromForwarded = !forwarded
    ? []
    : [...forwarded.matchAll(/for=(?:"?)(\[[^\]]+\]|[^;,"]+)/gi)]
        .map((m) => sanitizeIp((m[1] ?? "").trim()))
        .filter(Boolean);

  return [...fromXff, ...fromForwarded];
}

function pickBestPublicIp(candidates: string[]): string | null {
  for (const ip of candidates) {
    if (!isPrivateIp(ip)) return ip;
  }
  return candidates[0] ?? null;
}

function sanitizeIp(input: string): string {
  let s = input.trim();
  if (!s) return s;

  if (s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1).trim();
  }

  const bracket = s.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracket) return bracket[1];

  const ipv4Port = s.match(/^((?:\d{1,3}\.){3}\d{1,3}):\d+$/);
  if (ipv4Port) return ipv4Port[1];

  if (s.startsWith("::ffff:")) {
    return s.slice(7);
  }

  return s;
}

function isPrivateIp(ip: string): boolean {
  if (ip === "::1") return true;
  if (ip.startsWith("127.")) return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  const m = ip.match(/^172\.(\d{1,3})\./);
  if (m) {
    const b = Number(m[1]);
    return b >= 16 && b <= 31;
  }
  return false;
}

async function lookupLocation(ip: string): Promise<string | null> {
  const cleanIp = sanitizeIp(ip);
  if (!cleanIp || isPrivateIp(cleanIp)) return null;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 1200);

  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(cleanIp)}/json/`, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
      },
    });

    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;

    const city = typeof data.city === "string" ? data.city : "";
    const region = typeof data.region === "string" ? data.region : "";
    const country = typeof data.country_name === "string" ? data.country_name : "";

    const parts = [city, region, country].map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  } catch {
    // ignore
  } finally {
    clearTimeout(t);
  }

  const controller2 = new AbortController();
  const t2 = setTimeout(() => controller2.abort(), 1200);

  try {
    const res2 = await fetch(`https://ipwho.is/${encodeURIComponent(cleanIp)}`, {
      signal: controller2.signal,
      headers: {
        "Accept": "application/json",
      },
    });

    if (!res2.ok) return null;
    const data2 = (await res2.json()) as Record<string, unknown>;
    if (data2.success === false) return null;

    const city = typeof data2.city === "string" ? data2.city : "";
    const region = typeof data2.region === "string" ? data2.region : "";
    const country = typeof data2.country === "string" ? data2.country : "";

    const parts = [city, region, country].map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t2);
  }
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

  const xffChain = getForwardedForChain(req);
  const ip =
    pickBestPublicIp([
      getClientIp(req) ?? "",
      ...xffChain,
    ].filter(Boolean)) ?? "unknown";

  const ua = req.headers.get("user-agent") ?? "unknown";
  const path =
    typeof payload === "object" && payload !== null && "path" in payload
      ? String((payload as Record<string, unknown>).path)
      : "/";

  const location = ip !== "unknown" ? await lookupLocation(ip) : null;
  const locationLine = location ? `\nlocal: ${location}` : "";
  const chainLine = xffChain.length ? `\nip_chain: ${xffChain.join(",")}` : "";

  const text = `📍 Acesso no site\npath: ${path}${locationLine}\nip: ${ip}${chainLine}\nua: ${ua}`;

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
