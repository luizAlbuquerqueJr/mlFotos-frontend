import { useState, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import HeroCarousel from "@/components/HeroCarousel";
import AlbumsSection from "@/components/AlbumsSection";
import AboutSection from "@/components/AboutSection";
import ContactSection from "@/components/ContactSection";
import LoadingScreen from "@/components/LoadingScreen";
import { fetchSiteData, notifyAccess, type SiteData } from "@/lib/api";

function preloadImages(urls: string[]): Promise<void> {
  const unique = Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean)));
  if (unique.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(
    unique.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = src;
        }),
    ),
  ).then(() => undefined);
}

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const didRunEntryEffects = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchSiteData();
        const urlsToPreload = [
          ...data.homePhotos.map((p) => p.src),
          ...data.albums.map((album) => album.cover),
          ...(data.aboutPhotoUrl ? [data.aboutPhotoUrl] : []),
        ];

        await preloadImages(urlsToPreload);
        if (!cancelled) {
          setSiteData(data);
        }
      } catch (err) {
        console.error("Error fetching site data:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (didRunEntryEffects.current) return;
    didRunEntryEffects.current = true;

    notifyAccess(window.location.pathname)
      .catch((err) => console.error("Error notifying access:", err));
  }, []);

  return (
    <>
      <AnimatePresence>
        {loading && <LoadingScreen onFinish={() => {}} />}
      </AnimatePresence>

      {!loading && siteData && (
        <main className="min-h-screen bg-background w-full lg:max-w-[800px] lg:mx-auto">
          <Header />
          <HeroCarousel slides={siteData.homePhotos.map(p => p.src)} />
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
