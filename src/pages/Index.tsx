import { useState, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import HeroCarousel from "@/components/HeroCarousel";
import AlbumsSection from "@/components/AlbumsSection";
import AboutSection from "@/components/AboutSection";
import ContactSection from "@/components/ContactSection";
import LoadingScreen from "@/components/LoadingScreen";
import { fetchSiteData, notifyAccess, type SiteData, type FetchedPhoto } from "@/lib/api";

const MIN_LOADING_DURATION_MS = 3000;

function preloadImageFully(src: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const img = new Image();

    const settle = async () => {
      try {
        if (typeof img.decode === "function") {
          await img.decode();
        }
      } catch {
        resolve(false);
        return;
      }
      resolve(true);
    };

    img.onload = () => {
      void settle();
    };
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

function preloadImages(urls: string[]): Promise<void> {
  const unique = Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean)));
  if (unique.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(unique.map((src) => preloadImageFully(src))).then(() => undefined);
}

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [carouselPhotos, setCarouselPhotos] = useState<FetchedPhoto[]>([]);
  const didRunEntryEffects = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    (async () => {
      try {
        const data = await fetchSiteData();
        const urlsToPreload = data.homePhotos.map((p) => p.previewSrc || p.src);

        await preloadImages(urlsToPreload);
        if (!cancelled) {
          setSiteData(data);
          setCarouselPhotos(data.homePhotos);
        }
      } catch (err) {
        console.error("Error fetching site data:", err);
      } finally {
        if (!cancelled) {
          const elapsed = Date.now() - startedAt;
          const remaining = Math.max(0, MIN_LOADING_DURATION_MS - elapsed);
          if (remaining > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, remaining));
          }
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!siteData) return;

    let cancelled = false;
    const originalsToUpgrade = siteData.homePhotos
      .map((photo) => {
        const originalSrc = photo.originalSrc?.trim();
        const previewSrc = (photo.previewSrc || photo.src).trim();
        if (!originalSrc || originalSrc === previewSrc) return null;
        return originalSrc;
      })
      .filter((src): src is string => Boolean(src));

    if (originalsToUpgrade.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const results = await Promise.all(originalsToUpgrade.map((src) => preloadImageFully(src)));
      if (cancelled) return;

      const allLoaded = results.every(Boolean);
      if (!allLoaded) {
        return;
      }

      setCarouselPhotos(
        siteData.homePhotos.map((photo) => {
          const originalSrc = photo.originalSrc?.trim();
          const previewSrc = (photo.previewSrc || photo.src).trim();
          if (!originalSrc || originalSrc === previewSrc) {
            return photo;
          }

          return {
            ...photo,
            src: originalSrc,
          };
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [siteData]);

  useEffect(() => {
    if (didRunEntryEffects.current) return;
    didRunEntryEffects.current = true;

    notifyAccess(window.location.pathname)
      .catch((err) => console.error("Error notifying access:", err));
  }, []);

  return (
    <>
      <AnimatePresence>
        {loading && <LoadingScreen />}
      </AnimatePresence>

      {!loading && siteData && (
        <main className="min-h-screen bg-background w-full lg:max-w-[800px] lg:mx-auto">
          <Header />
          <HeroCarousel photos={carouselPhotos} />
          <AlbumsSection albums={siteData.albums} />
          <AboutSection photoUrl={siteData.aboutPhotoUrl} />
          <ContactSection />

          <footer className="py-10 text-center text-xs text-muted-foreground/40 tracking-widest font-medium">
            © 2026 Mônica Lima Photography
          </footer>
        </main>
      )}
    </>
  );
};

export default Index;
