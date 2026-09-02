import type { ClientContract, ClientPackage, ClientPhoto, ClientPhotoStatus } from "@/lib/clientPackages";
import { DEFAULT_CONTRACT, normalizeClientContract } from "@/lib/clientPackages";

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
    ? "https://mlfotos-api-512158927105.us-central1.run.app/users"
    : "http://localhost:8090/users");

const BUCKET_SIZE_URL = USERS_URL.replace("/users", "/bucket-size");

export function getClientPhotoPreviewUrl(clientId: string, photoId: string): string {
  const id = String(clientId || "").trim();
  const file = String(photoId || "").trim();
  if (!id || !file) return "";
  return `${USERS_URL}/${encodeURIComponent(id)}/photos/${encodeURIComponent(file)}/preview`;
}

export function getClientPhotoFileUrl(clientId: string, photoId: string): string {
  const id = String(clientId || "").trim();
  const file = String(photoId || "").trim();
  if (!id || !file) {
    throw new Error("Informe o id do cliente e da foto");
  }
  return `${USERS_URL}/${encodeURIComponent(id)}/photos/${encodeURIComponent(file)}/file`;
}

export type StorageBucketKey = "site" | "clientes";

export interface UserRecord {
  id: string;
  name: string;
  contract?: ClientContract;
  selectionSubmittedAt?: string | null;
  photoSelectionEnabled?: boolean;
  photos?: ClientPhoto[];
}

export interface BucketSizes {
  site: number;
  clientes: number;
  total: number;
}

async function fetchJson<T>(url: string, init?: RequestInit, authToken?: string): Promise<T> {
  const headers = { ...(init?.headers || {}) };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    mode: "cors",
    cache: "no-store",
    ...init,
    headers,
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

function parsePhoto(raw: unknown, clientId: string, originalsUnlocked = false): ClientPhoto | null {
  if (!raw || typeof raw !== "object") return null;
  const photo = raw as Record<string, unknown>;
  if (typeof photo.id !== "string" || typeof photo.name !== "string") return null;
  const status: ClientPhotoStatus = photo.status === "released" ? "released" : "selectable";
  return {
    id: photo.id,
    name: photo.name,
    previewUrl: getClientPhotoPreviewUrl(clientId, photo.id),
    originalUrl: status === "released" || originalsUnlocked ? getClientPhotoFileUrl(clientId, photo.id) : "",
    status,
    favorited: Boolean(photo.favorited),
  };
}

function parseClientPackage(raw: unknown): ClientPackage | null {
  if (!raw || typeof raw !== "object") return null;
  const user = raw as Record<string, unknown>;
  if (typeof user.id !== "string" || typeof user.name !== "string") return null;
  const photoSelectionEnabled = user.photoSelectionEnabled === true;
  const photos = Array.isArray(user.photos)
    ? user.photos
        .map((photo) => parsePhoto(photo, user.id, !photoSelectionEnabled))
        .filter((photo): photo is ClientPhoto => Boolean(photo))
    : [];
  return {
    id: user.id,
    name: user.name,
    contract: normalizeClientContract(user.contract as Partial<ClientContract> | undefined),
    photos,
    selectionSubmittedAt: typeof user.selectionSubmittedAt === "string" ? user.selectionSubmittedAt : undefined,
    photoSelectionEnabled,
  };
}

export async function listClientPackages(authToken?: string): Promise<ClientPackage[]> {
  const payload = await fetchJson<{ users?: unknown[] }>(USERS_URL, { method: "GET" }, authToken);
  return (payload.users ?? []).map(parseClientPackage).filter((item): item is ClientPackage => Boolean(item));
}

export async function getClientPackage(id: string, authToken?: string): Promise<ClientPackage> {
  const normalized = String(id || "").trim();
  if (!normalized) {
    throw new Error("Informe o id do cliente");
  }

  const payload = await fetchJson<{ user?: unknown }>(
    `${USERS_URL}/${encodeURIComponent(normalized)}`,
    { method: "GET" },
    authToken
  );

  const user = parseClientPackage(payload.user);
  if (!user) {
    throw new Error("Resposta inválida ao validar id");
  }
  return user;
}

export async function listUsers(authToken?: string): Promise<UserRecord[]> {
  const packages = await listClientPackages(authToken);
  return packages.map((item) => ({
    id: item.id,
    name: item.name,
    contract: item.contract,
    selectionSubmittedAt: item.selectionSubmittedAt,
    photos: item.photos,
  }));
}

export async function getUserById(id: string, authToken?: string): Promise<UserRecord> {
  const client = await getClientPackage(id, authToken);
  return {
    id: client.id,
    name: client.name,
    contract: client.contract,
    selectionSubmittedAt: client.selectionSubmittedAt,
    photoSelectionEnabled: client.photoSelectionEnabled,
    photos: client.photos,
  };
}

export async function createUser(
  name: string,
  authToken?: string,
  contract: ClientContract = DEFAULT_CONTRACT
): Promise<ClientPackage> {
  const payload = await fetchJson<unknown>(
    USERS_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, contract }),
    },
    authToken
  );

  const created = parseClientPackage(payload);
  if (!created) {
    throw new Error("Resposta inválida ao criar usuário");
  }
  return created;
}

export async function updateUser(
  id: string,
  patch: { name?: string; contract?: Partial<ClientContract> },
  authToken?: string
): Promise<ClientPackage> {
  const payload = await fetchJson<{ user?: unknown }>(
    `${USERS_URL}/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
    authToken
  );

  const updated = parseClientPackage(payload.user);
  if (!updated) {
    throw new Error("Resposta inválida ao atualizar cliente");
  }
  return updated;
}

export async function deleteUser(id: string, authToken?: string): Promise<void> {
  await fetchJson<{ ok?: boolean }>(`${USERS_URL}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  }, authToken);
}

export async function toggleClientPhotoFavorite(
  id: string,
  photoId: string,
  favorited: boolean
): Promise<{ photoId: string; favorited: boolean }> {
  const payload = await fetchJson<{ photoId?: unknown; favorited?: unknown }>(
    `${USERS_URL}/${encodeURIComponent(id)}/photos/favorite`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId, favorited }),
    }
  );
  if (typeof payload.photoId !== "string" || typeof payload.favorited !== "boolean") {
    throw new Error("Resposta inválida ao salvar o coração");
  }
  return { photoId: payload.photoId, favorited: payload.favorited };
}

export async function notifyClientSelection(id: string): Promise<ClientPackage> {
  const payload = await fetchJson<{ user?: unknown }>(`${USERS_URL}/${encodeURIComponent(id)}/selection/notify`, {
    method: "POST",
  });
  const updated = parseClientPackage(payload.user);
  if (!updated) {
    throw new Error("Resposta inválida ao avisar a seleção");
  }
  return updated;
}

export async function releaseClientPhotos(id: string, authToken?: string): Promise<ClientPackage> {
  const payload = await fetchJson<{ user?: unknown }>(
    `${USERS_URL}/${encodeURIComponent(id)}/photos/release`,
    { method: "POST" },
    authToken
  );
  const updated = parseClientPackage(payload.user);
  if (!updated) {
    throw new Error("Resposta inválida ao liberar fotos");
  }
  return updated;
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
      originalUrl: typeof file.originalUrl === "string" ? file.originalUrl : undefined,
      previewUrl: typeof file.previewUrl === "string" ? file.previewUrl : undefined,
      thumbUrl: typeof file.thumbUrl === "string" ? file.thumbUrl : undefined,
    })),
  };
}

function withBucketQuery(url: string, bucket: StorageBucketKey): string {
  const hasQuery = url.includes("?");
  return `${url}${hasQuery ? "&" : "?"}bucket=${encodeURIComponent(bucket)}`;
}

async function postStorageOperation<T>(
  body: Record<string, unknown>,
  opts?: { bucket?: StorageBucketKey; authToken?: string }
): Promise<T> {
  const bucket = opts?.bucket ?? "site";
  const url = withBucketQuery(STORAGE_UPLOAD_URL, bucket);
  const authToken = typeof opts?.authToken === "string" ? opts.authToken.trim() : "";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
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
  originalUrl?: string;
  previewUrl?: string;
  thumbUrl?: string;
}

export interface ManagerListing {
  currentPath: string;
  folders: ManagerFolderItem[];
  files: ManagerFileItem[];
}

export interface FetchedPhoto {
  src: string;
  alt: string;
  originalSrc?: string;
  previewSrc?: string;
  thumbSrc?: string;
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

function buildImageVariantUrl(originalUrl: string, variant: "thumb" | "preview"): string | null {
  if (!originalUrl) return null;

  try {
    const parsed = new URL(originalUrl);
    const segments = parsed.pathname.split("/");
    const fileName = decodeURIComponent(segments.pop() || "");
    if (!fileName || !/\.[a-z0-9]+$/i.test(fileName)) return null;

    const dotIndex = fileName.lastIndexOf(".");
    if (dotIndex <= 0) return null;

    const baseName = fileName.slice(0, dotIndex);
    const variantName = `${baseName}__${variant}.webp`;
    segments.push(encodeURIComponent(variantName));
    parsed.pathname = segments.join("/");
    return parsed.toString();
  } catch {
    return null;
  }
}

function toFetchedPhoto(photo: StorageListPhoto): FetchedPhoto {
  const originalSrc = photo.src;
  const previewSrc = buildImageVariantUrl(originalSrc, "preview") || originalSrc;
  const thumbSrc = buildImageVariantUrl(originalSrc, "thumb") || previewSrc || originalSrc;

  return {
    src: previewSrc,
    alt: photo.alt,
    originalSrc,
    previewSrc,
    thumbSrc,
  };
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

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
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

  const homePhotos = (raw.homePhotos ?? []).map(toFetchedPhoto);
  const shuffledHomePhotos = shuffleArray(homePhotos);

  return {
    homePhotos: shuffledHomePhotos,
    albums: (raw.albums ?? []).map((album) => ({
      id: album.id,
      title: album.title,
      cover: buildImageVariantUrl(album.cover, "thumb") || album.cover,
      photos: (album.photos ?? []).map(toFetchedPhoto),
    })),
    logoUrl: raw.logoUrl ?? null,
    sobreUrl: raw.sobreUrl ?? null,
    aboutPhotoUrl: raw.aboutPhotoUrl
      ? buildImageVariantUrl(raw.aboutPhotoUrl, "preview") || raw.aboutPhotoUrl
      : null,
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

export async function listManagerPath(
  path = "",
  bucket: StorageBucketKey = "site",
  authToken?: string
): Promise<ManagerListing> {
  const payload = await postStorageOperation<unknown>(
    {
    operation: "listManager",
    currentPath: path,
    },
    { bucket, authToken }
  );

  return parseManagerPayload(payload);
}

export async function buildManifest(authToken?: string): Promise<string> {
  const payload = await postStorageOperation<{ url?: string }>(
    {
      operation: "buildManifest",
    },
    { bucket: "site", authToken }
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
  bucket: StorageBucketKey = "site",
  authToken?: string
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
    { bucket, authToken }
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
  bucket: StorageBucketKey = "site",
  authToken?: string
): Promise<string> {
  const payload = await postStorageOperation<{ path?: string }>(
    {
      operation: "createFolder",
      parentPath,
      newName: name,
    },
    { bucket, authToken }
  );

  if (!payload.path) {
    throw new Error("Resposta inválida ao criar pasta");
  }

  return payload.path;
}

export async function renameFolder(
  folderPath: string,
  name: string,
  bucket: StorageBucketKey = "site",
  authToken?: string
): Promise<string> {
  const payload = await postStorageOperation<{ path?: string }>(
    {
      operation: "renameFolder",
      folderPath,
      newName: name,
    },
    { bucket, authToken }
  );

  if (!payload.path) {
    throw new Error("Resposta inválida ao renomear pasta");
  }

  return payload.path;
}

export async function deleteFolder(
  folderPath: string,
  bucket: StorageBucketKey = "site",
  authToken?: string
): Promise<void> {
  await postStorageOperation<{ ok?: boolean }>(
    {
      operation: "deleteFolder",
      folderPath,
    },
    { bucket, authToken }
  );
}

export async function renameFile(
  filePath: string,
  name: string,
  bucket: StorageBucketKey = "site",
  authToken?: string
): Promise<string> {
  const payload = await postStorageOperation<{ path?: string }>(
    {
      operation: "renameFile",
      filePath,
      newName: name,
    },
    { bucket, authToken }
  );

  if (!payload.path) {
    throw new Error("Resposta inválida ao renomear arquivo");
  }

  return payload.path;
}

export async function deleteFile(
  filePath: string,
  bucket: StorageBucketKey = "site",
  authToken?: string
): Promise<void> {
  await postStorageOperation<{ ok?: boolean }>(
    {
      operation: "deleteFile",
      filePath,
    },
    { bucket, authToken }
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

export async function getBucketSizes(authToken?: string): Promise<BucketSizes> {
  return fetchJson<BucketSizes>(BUCKET_SIZE_URL, { method: "GET" }, authToken);
}
