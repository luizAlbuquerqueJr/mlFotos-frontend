import { getGoogleAccessToken, toPublicObjectUrl } from "../_shared/gcp.ts";

type DenoLike = {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const deno = (globalThis as { Deno?: DenoLike }).Deno;

if (!deno) {
  throw new Error("Deno runtime not available");
}

const runtime = deno;
const BUCKET_NAME = "fotos-monica-lima";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UploadPayload = {
  category?: "home" | "album";
  albumName?: string;
  fileName?: string;
  contentType?: string;
  fileDataBase64?: string;
};

function sanitizeFolderSegment(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[\\:*?"<>|]/g, "-");
}

function sanitizeFileName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\\:*?"<>|]/g, "-")
    .replace(/^\/+|\/+$/g, "");

  return cleaned || `upload-${Date.now()}.bin`;
}

function getObjectPath(payload: UploadPayload): string {
  const category = payload.category;
  const fileName = sanitizeFileName(payload.fileName ?? "");

  if (category === "home") {
    return `home/${fileName}`;
  }

  if (category === "album") {
    const albumName = sanitizeFolderSegment(payload.albumName ?? "");
    if (!albumName) {
      throw new Error("albumName é obrigatório para uploads de álbum");
    }

    return `albuns/${albumName}/${fileName}`;
  }

  throw new Error("category deve ser 'home' ou 'album'");
}

function decodeBase64File(input: string): ArrayBuffer {
  const base64 = input.includes(",") ? input.split(",")[1] : input;
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return buffer;
}

runtime.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: UploadPayload;
  try {
    payload = (await req.json()) as UploadPayload;
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!payload.fileDataBase64 || !payload.fileName) {
    return new Response(JSON.stringify({ error: "fileDataBase64 e fileName são obrigatórios" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const objectPath = getObjectPath(payload);
    const fileBuffer = decodeBase64File(payload.fileDataBase64);
    const uploadBody = new Blob([fileBuffer], {
      type: payload.contentType ?? "application/octet-stream",
    });
    const accessToken = await getGoogleAccessToken();

    const uploadUrl = new URL(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET_NAME}/o`);
    uploadUrl.searchParams.set("uploadType", "media");
    uploadUrl.searchParams.set("name", objectPath);

    const uploadResponse = await fetch(uploadUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": payload.contentType ?? "application/octet-stream",
      },
      body: uploadBody,
    });

    if (!uploadResponse.ok) {
      const details = await uploadResponse.text();
      return new Response(JSON.stringify({ error: "Falha ao salvar no bucket", details }), {
        status: uploadResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        path: objectPath,
        url: toPublicObjectUrl(BUCKET_NAME, objectPath),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro inesperado" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
