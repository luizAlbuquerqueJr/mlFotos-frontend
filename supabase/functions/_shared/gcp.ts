type DenoLike = {
  env: {
    get: (key: string) => string | undefined;
  };
};

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

const deno = (globalThis as { Deno?: DenoLike }).Deno;

if (!deno) {
  throw new Error("Deno runtime not available");
}

const runtime = deno;

function base64UrlEncode(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.byteLength; i += 1) {
    binary += String.fromCharCode(data[i]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function encodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function parsePemPrivateKey(privateKeyPem: string): ArrayBuffer {
  const normalized = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");

  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

function getServiceAccountFromEnv(): ServiceAccount {
  const raw = runtime.env.get("GOOGLE_SERVICE_ACCOUNT_STORAGE");
  if (!raw) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_STORAGE env var");
  }

  const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_STORAGE payload");
  }

  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key,
    token_uri: parsed.token_uri,
  };
}

async function createJwtAssertion(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/devstorage.read_write",
    aud: serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsignedToken = `${encodeJson(header)}.${encodeJson(payload)}`;

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    parsePemPrivateKey(serviceAccount.private_key),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedToken),
  );

  return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function getGoogleAccessToken(): Promise<string> {
  const serviceAccount = getServiceAccountFromEnv();
  const assertion = await createJwtAssertion(serviceAccount);

  const response = await fetch(serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Could not obtain Google access token: ${details}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Google OAuth token response missing access_token");
  }

  return payload.access_token;
}

export function toPublicObjectUrl(bucketName: string, objectPath: string): string {
  const encodedPath = objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://storage.googleapis.com/${bucketName}/${encodedPath}`;
}
