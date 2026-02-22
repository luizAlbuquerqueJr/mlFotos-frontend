const API_URL = "https://ygjosyxbfdqfkcqmhqva.supabase.co/functions/v1/fotografia-molu";
const API_KEY = "sb_publishable_ccwkOvXWvMOXdYtje92uJg_2G4Dc9_p";

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

export async function fetchSiteData(folderUrl: string): Promise<SiteData> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "apikey": API_KEY,
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
