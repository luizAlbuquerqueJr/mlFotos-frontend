const SUPABASE_PROJECT_URL = "https://ygjosyxbfdqfkcqmhqva.supabase.co";
const API_KEY = "sb_publishable_ccwkOvXWvMOXdYtje92uJg_2G4Dc9_p";
function readEnvUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

const STORAGE_LIST_URL =
  readEnvUrl(import.meta.env.VITE_STORAGE_LIST_URL) ??
  (import.meta.env.PROD
    ? "https://us-central1-fotografia-488219.cloudfunctions.net/storage-list"
    : "http://localhost:8082");
const STORAGE_UPLOAD_URL =
  readEnvUrl(import.meta.env.VITE_STORAGE_UPLOAD_URL) ??
  (import.meta.env.PROD
    ? "https://us-central1-fotografia-488219.cloudfunctions.net/storage-upload"
    : "http://localhost:8081");
const NOTIFY_URL = `${SUPABASE_PROJECT_URL}/functions/v1/notify-access`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? API_KEY;

interface ClientGeo {
  ip: string;
  location: string | null;
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

async function postStorageOperation<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(STORAGE_UPLOAD_URL, {
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
    throw new Error(
      `Resposta inválida do servidor (esperado JSON) em ${STORAGE_UPLOAD_URL}: ${response.status} ${details.slice(0, 200)}`
    );
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

  return { ip, location: formatLocation(city, region, country) };
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

  return { ip, location: formatLocation(city, region, country) };
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

  return { ip: "unknown", location: null };
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
  const response = await fetch(STORAGE_LIST_URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    mode: "cors",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch photos: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const details = await response.text();
    throw new Error(
      `Resposta inválida do servidor (esperado JSON) em ${STORAGE_LIST_URL}: ${response.status} ${details.slice(0, 200)}`
    );
  }

  const data = await response.json();
  return parseStorageListPayload(data);
}

export async function listManagerPath(path = ""): Promise<ManagerListing> {
  const url = new URL(STORAGE_LIST_URL);
  url.searchParams.set("mode", "manager");
  url.searchParams.set("path", path);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    mode: "cors",
  });

  if (!response.ok) {
    throw new Error(`Falha ao listar diretório: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const details = await response.text();
    throw new Error(
      `Resposta inválida do servidor (esperado JSON) em ${url.toString()}: ${response.status} ${details.slice(0, 200)}`
    );
  }

  return parseManagerPayload(await response.json());
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

  const payload = await postStorageOperation<Partial<UploadedImage>>({
    operation: "upload",
    category: input.category,
    albumName: input.albumName,
    fileName: input.file.name,
    contentType: input.file.type,
    fileDataBase64,
  });

  if (!payload.path || !payload.url) {
    throw new Error("Resposta de upload inválida");
  }

  return {
    path: payload.path,
    url: payload.url,
  };
}

export async function uploadImageToPath(folderPath: string, file: File): Promise<UploadedImage> {
  const fileDataBase64 = await readFileAsBase64(file);

  const payload = await postStorageOperation<Partial<UploadedImage>>({
    operation: "upload",
    folderPath,
    fileName: file.name,
    contentType: file.type,
    fileDataBase64,
  });

  if (!payload.path || !payload.url) {
    throw new Error("Resposta de upload inválida");
  }

  return {
    path: payload.path,
    url: payload.url,
  };
}

export async function createFolder(parentPath: string, name: string): Promise<string> {
  const payload = await postStorageOperation<{ path?: string }>({
    operation: "createFolder",
    parentPath,
    newName: name,
  });

  if (!payload.path) {
    throw new Error("Resposta inválida ao criar pasta");
  }

  return payload.path;
}

export async function renameFolder(folderPath: string, name: string): Promise<string> {
  const payload = await postStorageOperation<{ path?: string }>({
    operation: "renameFolder",
    folderPath,
    newName: name,
  });

  if (!payload.path) {
    throw new Error("Resposta inválida ao renomear pasta");
  }

  return payload.path;
}

export async function deleteFolder(folderPath: string): Promise<void> {
  await postStorageOperation<{ ok?: boolean }>({
    operation: "deleteFolder",
    folderPath,
  });
}

export async function renameFile(filePath: string, name: string): Promise<string> {
  const payload = await postStorageOperation<{ path?: string }>({
    operation: "renameFile",
    filePath,
    newName: name,
  });

  if (!payload.path) {
    throw new Error("Resposta inválida ao renomear arquivo");
  }

  return payload.path;
}

export async function deleteFile(filePath: string): Promise<void> {
  await postStorageOperation<{ ok?: boolean }>({
    operation: "deleteFile",
    filePath,
  });
}

export async function notifyAccess(path: string): Promise<void> {
  const { ip, location } = await getClientGeo();
  const ua = navigator.userAgent ?? "unknown";
  const locationLine = location ? `\nlocal: ${location}` : "";
  const text = `📍 Acesso no site\npath: ${path}${locationLine}\nip: ${ip}\nua: ${ua}`;

  const response = await fetch(NOTIFY_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ text }),
    mode: "cors",
  });

  if (!response.ok) {
    throw new Error(`Failed to notify access: ${response.status}`);
  }
}
