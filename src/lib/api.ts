function readEnvUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

const STORAGE_UPLOAD_URL =
  readEnvUrl(import.meta.env.VITE_STORAGE_UPLOAD_URL) ??
  (import.meta.env.PROD
    ? "https://us-central1-fotografia-488219.cloudfunctions.net/storage-upload"
    : "http://localhost:8081");

const SITE_MANIFEST_URL =
  readEnvUrl(import.meta.env.VITE_SITE_MANIFEST_URL) ??
  "https://storage.googleapis.com/fotos-monica-lima/site-manifest.json";

const NOTIFY_URL =
  readEnvUrl(import.meta.env.VITE_NOTIFY_ACCESS_URL) ??
  (import.meta.env.PROD
    ? "https://us-central1-fotografia-488219.cloudfunctions.net/notify-access"
    : "http://localhost:8082");

const USERS_URL =
  readEnvUrl(import.meta.env.VITE_USERS_URL) ??
  (import.meta.env.PROD
    ? "https://us-central1-fotografia-488219.cloudfunctions.net/users"
    : "http://localhost:8090/users");

export type StorageBucketKey = "site" | "clientes";

export interface UserRecord {
  id: string;
  name: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    mode: "cors",
    ...init,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Falha na requisição: ${response.status} ${details}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const details = await response.text();
    throw new Error(`Resposta inválida do servidor (esperado JSON) em ${url}: ${response.status} ${details.slice(0, 200)}`);
  }

  return (await response.json()) as T;
}

export async function listUsers(): Promise<UserRecord[]> {
  const payload = await fetchJson<{ users?: Array<Partial<UserRecord>> }>(USERS_URL, { method: "GET" });
  return (payload.users ?? [])
    .filter((u) => typeof u.id === "string" && typeof u.name === "string")
    .map((u) => ({ id: u.id as string, name: u.name as string }));
}

export async function getUserById(id: string): Promise<UserRecord> {
  const normalized = String(id || "").trim();
  if (!normalized) {
    throw new Error("Informe o id do cliente");
  }

  const payload = await fetchJson<{ user?: Partial<UserRecord> }>(
    `${USERS_URL}/${encodeURIComponent(normalized)}`,
    { method: "GET" }
  );

  const user = payload.user;
  if (!user || typeof user.id !== "string" || typeof user.name !== "string") {
    throw new Error("Resposta inválida ao validar id");
  }

  return { id: user.id, name: user.name };
}

export async function createUser(name: string): Promise<UserRecord> {
  const payload = await fetchJson<Partial<UserRecord>>(USERS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  if (!payload.id || !payload.name) {
    throw new Error("Resposta inválida ao criar usuário");
  }

  return { id: payload.id, name: payload.name };
}

export async function updateUser(id: string, patch: { name?: string }): Promise<void> {
  await fetchJson<{ ok?: boolean }>(`${USERS_URL}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function deleteUser(id: string): Promise<void> {
  await fetchJson<{ ok?: boolean }>(`${USERS_URL}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function getClientPhotosZipUrl(id: string): string {
  const normalized = String(id || "").trim();
  if (!normalized) {
    throw new Error("Informe o id do cliente");
  }

  return `${USERS_URL}/${encodeURIComponent(normalized)}/photos.zip`;
}

interface ClientGeo {
  ip: string;
  location: string | null;
  countryCode: string | null;
}

function parseManagerPayload(payload: unknown): ManagerListing {
  if (!payload || typeof payload !== "object") {
    throw new Error("Resposta inválida do gerenciador");
  }

  const data = payload as StorageManagerPayload;

  return {
    currentPath: typeof data.currentPath === "string" ? data.currentPath : "",
    folders: (data.folders ?? []).map((folder) => ({
      name: folder.name,
      path: folder.path,
    })),
    files: (data.files ?? []).map((file) => ({
      name: file.name,
      path: file.path,
      url: file.url,
    })),
  };
}

function withBucketQuery(url: string, bucket: StorageBucketKey): string {
  const hasQuery = url.includes("?");
  return `${url}${hasQuery ? "&" : "?"}bucket=${encodeURIComponent(bucket)}`;
}

async function postStorageOperation<T>(
  body: Record<string, unknown>,
  opts?: { bucket?: StorageBucketKey }
): Promise<T> {
  const bucket = opts?.bucket ?? "site";
  const url = withBucketQuery(STORAGE_UPLOAD_URL, bucket);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    mode: "cors",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Falha na operação: ${response.status} ${details}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const details = await response.text();
    throw new Error(`Resposta inválida do servidor (esperado JSON) em ${url}: ${response.status} ${details.slice(0, 200)}`);
  }

  return (await response.json()) as T;
}

export interface UploadImageInput {
  category: "home" | "album";
  file: File;
  albumName?: string;
}

export interface UploadedImage {
  path: string;
  url: string;
}

export interface ManagerFolderItem {
  name: string;
  path: string;
}

export interface ManagerFileItem {
  name: string;
  path: string;
  url: string;
}

export interface ManagerListing {
  currentPath: string;
  folders: ManagerFolderItem[];
  files: ManagerFileItem[];
}

export interface FetchedPhoto {
  src: string;
  alt: string;
}

export interface FetchedAlbum {
  id: string;
  title: string;
  cover: string;
  photos: FetchedPhoto[];
}

export interface SiteData {
  homePhotos: FetchedPhoto[];
  albums: FetchedAlbum[];
  logoUrl: string | null;
  sobreUrl: string | null;
  aboutPhotoUrl: string | null;
}

interface StorageListPhoto {
  src: string;
  alt: string;
  path?: string;
}

interface StorageListAlbum {
  id: string;
  title: string;
  cover: string;
  photos: StorageListPhoto[];
}

interface StorageManagerPayload {
  currentPath?: string;
  folders?: ManagerFolderItem[];
  files?: ManagerFileItem[];
}

function formatLocation(city: string, region: string, country: string): string | null {
  const parts = [city, region, country].map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

async function lookupGeoFromIpApi(): Promise<ClientGeo | null> {
  const res = await fetch("https://ipapi.co/json/", {
    headers: { "Accept": "application/json" },
  });

  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;

  const ip = typeof data.ip === "string" ? data.ip : "unknown";
  const city = typeof data.city === "string" ? data.city : "";
  const region = typeof data.region === "string" ? data.region : "";
  const country = typeof data.country_name === "string" ? data.country_name : "";
  const countryCode = typeof data.country_code === "string" ? data.country_code : null;

  return { ip, location: formatLocation(city, region, country), countryCode };
}

async function lookupGeoFromIpWho(): Promise<ClientGeo | null> {
  const res = await fetch("https://ipwho.is/", {
    headers: { "Accept": "application/json" },
  });

  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  if (data.success === false) return null;

  const ip = typeof data.ip === "string" ? data.ip : "unknown";
  const city = typeof data.city === "string" ? data.city : "";
  const region = typeof data.region === "string" ? data.region : "";
  const country = typeof data.country === "string" ? data.country : "";
  const countryCode = typeof data.country_code === "string" ? data.country_code : null;

  return { ip, location: formatLocation(city, region, country), countryCode };
}

async function getClientGeo(): Promise<ClientGeo> {
  try {
    const fromIpApi = await lookupGeoFromIpApi();
    if (fromIpApi) return fromIpApi;
  } catch {
    // ignore
  }

  try {
    const fromIpWho = await lookupGeoFromIpWho();
    if (fromIpWho) return fromIpWho;
  } catch {
    // ignore
  }

  return { ip: "unknown", location: null, countryCode: null };
}

function parseStorageListPayload(payload: unknown): SiteData {
  if (!payload || typeof payload !== "object") {
    throw new Error("Resposta inválida da função de listagem");
  }

  const raw = payload as {
    homePhotos?: StorageListPhoto[];
    albums?: StorageListAlbum[];
    logoUrl?: string | null;
    sobreUrl?: string | null;
    aboutPhotoUrl?: string | null;
  };

  return {
    homePhotos: (raw.homePhotos ?? []).map((photo) => ({ src: photo.src, alt: photo.alt })),
    albums: (raw.albums ?? []).map((album) => ({
      id: album.id,
      title: album.title,
      cover: album.cover,
      photos: (album.photos ?? []).map((photo) => ({ src: photo.src, alt: photo.alt })),
    })),
    logoUrl: raw.logoUrl ?? null,
    sobreUrl: raw.sobreUrl ?? null,
    aboutPhotoUrl: raw.aboutPhotoUrl ?? null,
  };
}

export async function fetchSiteData(): Promise<SiteData> {
  const response = await fetch(SITE_MANIFEST_URL, { method: "GET" });

  if (!response.ok) {
    throw new Error(`Failed to fetch photos: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const details = await response.text();
    throw new Error(
      `Resposta inválida do servidor (esperado JSON) em ${SITE_MANIFEST_URL}: ${response.status} ${details.slice(0, 200)}`
    );
  }

  const data = await response.json();
  return parseStorageListPayload(data);
}

export async function listManagerPath(path = "", bucket: StorageBucketKey = "site"): Promise<ManagerListing> {
  const payload = await postStorageOperation<unknown>(
    {
    operation: "listManager",
    currentPath: path,
    },
    { bucket }
  );

  return parseManagerPayload(payload);
}

export async function buildManifest(): Promise<string> {
  const payload = await postStorageOperation<{ url?: string }>(
    {
      operation: "buildManifest",
    },
    { bucket: "site" }
  );

  if (!payload.url) {
    throw new Error("Resposta inválida ao gerar manifest");
  }

  return payload.url;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Falha ao converter arquivo para base64"));
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(input: UploadImageInput): Promise<UploadedImage> {
  if (input.category === "album" && !input.albumName?.trim()) {
    throw new Error("Informe o nome do álbum");
  }

  const fileDataBase64 = await readFileAsBase64(input.file);

  const payload = await postStorageOperation<Partial<UploadedImage>>(
    {
      operation: "upload",
      category: input.category,
      albumName: input.albumName,
      fileName: input.file.name,
      contentType: input.file.type,
      fileDataBase64,
    },
    { bucket: "site" }
  );

  if (!payload.path || !payload.url) {
    throw new Error("Resposta de upload inválida");
  }

  return {
    path: payload.path,
    url: payload.url,
  };
}

export async function uploadImageToPath(
  folderPath: string,
  file: File,
  bucket: StorageBucketKey = "site"
): Promise<UploadedImage> {
  const fileDataBase64 = await readFileAsBase64(file);

  const payload = await postStorageOperation<Partial<UploadedImage>>(
    {
      operation: "upload",
      folderPath,
      fileName: file.name,
      contentType: file.type,
      fileDataBase64,
    },
    { bucket }
  );

  if (!payload.path || !payload.url) {
    throw new Error("Resposta de upload inválida");
  }

  return {
    path: payload.path,
    url: payload.url,
  };
}

export async function createFolder(
  parentPath: string,
  name: string,
  bucket: StorageBucketKey = "site"
): Promise<string> {
  const payload = await postStorageOperation<{ path?: string }>(
    {
      operation: "createFolder",
      parentPath,
      newName: name,
    },
    { bucket }
  );

  if (!payload.path) {
    throw new Error("Resposta inválida ao criar pasta");
  }

  return payload.path;
}

export async function renameFolder(
  folderPath: string,
  name: string,
  bucket: StorageBucketKey = "site"
): Promise<string> {
  const payload = await postStorageOperation<{ path?: string }>(
    {
      operation: "renameFolder",
      folderPath,
      newName: name,
    },
    { bucket }
  );

  if (!payload.path) {
    throw new Error("Resposta inválida ao renomear pasta");
  }

  return payload.path;
}

export async function deleteFolder(folderPath: string, bucket: StorageBucketKey = "site"): Promise<void> {
  await postStorageOperation<{ ok?: boolean }>(
    {
      operation: "deleteFolder",
      folderPath,
    },
    { bucket }
  );
}

export async function renameFile(
  filePath: string,
  name: string,
  bucket: StorageBucketKey = "site"
): Promise<string> {
  const payload = await postStorageOperation<{ path?: string }>(
    {
      operation: "renameFile",
      filePath,
      newName: name,
    },
    { bucket }
  );

  if (!payload.path) {
    throw new Error("Resposta inválida ao renomear arquivo");
  }

  return payload.path;
}

export async function deleteFile(filePath: string, bucket: StorageBucketKey = "site"): Promise<void> {
  await postStorageOperation<{ ok?: boolean }>(
    {
      operation: "deleteFile",
      filePath,
    },
    { bucket }
  );
}

export async function notifyAccess(path: string): Promise<void> {
  const { ip, location, countryCode } = await getClientGeo();
  if ((countryCode || "").toUpperCase() !== "BR") {
    return;
  }
  const ua = navigator.userAgent ?? "unknown";
  const locationLine = location ? `\nlocal: ${location}` : "";
  const text = `📍 Acesso no site\npath: ${path}${locationLine}\nip: ${ip}\nua: ${ua}`;

  const response = await fetch(NOTIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
    mode: "cors",
  });

  if (!response.ok) {
    throw new Error(`Failed to notify access: ${response.status}`);
  }
}
