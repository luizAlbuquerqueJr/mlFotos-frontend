const API_URL = "https://ygjosyxbfdqfkcqmhqva.supabase.co/functions/v1/fotografia-molu";
const API_KEY = "sb_publishable_ccwkOvXWvMOXdYtje92uJg_2G4Dc9_p";
const NOTIFY_URL = "https://ygjosyxbfdqfkcqmhqva.supabase.co/functions/v1/notify-access";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? API_KEY;

interface ClientGeo {
  ip: string;
  location: string | null;
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

function extractIdFromUrl(url: string): string {
  const match = url.match(/id=([^&]+)/);
  return match ? match[1] : "";
}

function toEmbedUrl(driveUrl: string): string {
  const id = extractIdFromUrl(driveUrl);
  return id ? `https://lh3.googleusercontent.com/d/${id}=s1920` : driveUrl;
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

export async function fetchSiteData(folderUrl: string): Promise<SiteData> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ url: folderUrl }),
    mode: "cors",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch photos: ${response.status}`);
  }

  const data = await response.json();

  // Parse the nested response structure
  const siteArray = data["site fotografia molu"] as Record<string, unknown>[];

  const result: SiteData = {
    homePhotos: [],
    albums: [],
    logoUrl: null,
    sobreUrl: null,
    aboutPhotoUrl: null,
  };

  for (const item of siteArray) {
    // Home photos
    if ("Home" in item) {
      const homeItems = item["Home"] as Record<string, string>[];
      result.homePhotos = homeItems.map((entry) => {
        const [filename, url] = Object.entries(entry)[0];
        return { src: toEmbedUrl(url), alt: filename };
      });
    }

    // Logo
    if ("logo.jpg" in item) {
      result.logoUrl = toEmbedUrl(item["logo.jpg"] as string);
    }

    // Sobre
    if ("sobre.txt" in item) {
      result.sobreUrl = item["sobre.txt"] as string;
    }

    // About photo (about.jpg, about.png, etc.)
    const aboutKey = Object.keys(item).find(k => k.toLowerCase().startsWith("about."));
    if (aboutKey) {
      result.aboutPhotoUrl = toEmbedUrl(item[aboutKey] as string);
    }

    // Albums
    if ("Álbuns" in item) {
      const albumsArray = item["Álbuns"] as Record<string, Record<string, string>[]>[];
      for (const albumEntry of albumsArray) {
        const [title, photosArray] = Object.entries(albumEntry)[0];
        const photos: FetchedPhoto[] = photosArray.map((photoEntry) => {
          const [filename, url] = Object.entries(photoEntry)[0];
          return { src: toEmbedUrl(url), alt: filename };
        });
        result.albums.push({
          id: title.toLowerCase().replace(/\s+/g, "-"),
          title,
          cover: photos[0]?.src || "",
          photos,
        });
      }
    }
  }

  return result;
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
