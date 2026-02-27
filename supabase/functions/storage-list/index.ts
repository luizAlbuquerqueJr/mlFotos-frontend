import { getGoogleAccessToken, toPublicObjectUrl } from "../_shared/gcp.ts";

type DenoLike = {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type BucketObject = {
  name: string;
};

type ListedPhoto = {
  src: string;
  alt: string;
  path: string;
};

type ListedAlbum = {
  id: string;
  title: string;
  cover: string;
  photos: ListedPhoto[];
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
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function isImageObject(path: string): boolean {
  return /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(path);
}

function getFileName(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? path;
}

function toAlbumId(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function listAllObjects(accessToken: string): Promise<BucketObject[]> {
  const allItems: BucketObject[] = [];
  let nextPageToken: string | undefined;

  do {
    const url = new URL(`https://storage.googleapis.com/storage/v1/b/${BUCKET_NAME}/o`);
    url.searchParams.set("fields", "items(name),nextPageToken");

    if (nextPageToken) {
      url.searchParams.set("pageToken", nextPageToken);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Falha ao listar objetos: ${await response.text()}`);
    }

    const payload = (await response.json()) as { items?: BucketObject[]; nextPageToken?: string };
    allItems.push(...(payload.items ?? []));
    nextPageToken = payload.nextPageToken;
  } while (nextPageToken);

  return allItems;
}

function buildResponse(objects: BucketObject[]) {
  const homePhotos: ListedPhoto[] = [];
  const albumsMap = new Map<string, ListedAlbum>();

  for (const item of objects) {
    const path = item.name;
    if (!path || !isImageObject(path)) {
      continue;
    }

    if (path.startsWith("home/")) {
      homePhotos.push({
        src: toPublicObjectUrl(BUCKET_NAME, path),
        alt: getFileName(path),
        path,
      });
      continue;
    }

    if (!path.startsWith("albuns/")) {
      continue;
    }

    const withoutPrefix = path.slice("albuns/".length);
    const firstSlash = withoutPrefix.indexOf("/");
    if (firstSlash <= 0) {
      continue;
    }

    const albumTitle = withoutPrefix.slice(0, firstSlash);
    const albumId = toAlbumId(albumTitle);

    if (!albumsMap.has(albumId)) {
      albumsMap.set(albumId, {
        id: albumId,
        title: albumTitle,
        cover: "",
        photos: [],
      });
    }

    const album = albumsMap.get(albumId)!;
    album.photos.push({
      src: toPublicObjectUrl(BUCKET_NAME, path),
      alt: getFileName(path),
      path,
    });
  }

  homePhotos.sort((a, b) => a.path.localeCompare(b.path, "pt-BR"));

  const albums = Array.from(albumsMap.values())
    .map((album) => {
      album.photos.sort((a, b) => a.path.localeCompare(b.path, "pt-BR"));
      album.cover = album.photos[0]?.src ?? "";
      return album;
    })
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));

  return {
    homePhotos,
    albums,
    logoUrl: null,
    sobreUrl: null,
    aboutPhotoUrl: null,
  };
}

runtime.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const accessToken = await getGoogleAccessToken();
    const objects = await listAllObjects(accessToken);
    const data = buildResponse(objects);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
