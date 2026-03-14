import { useState, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import HeroCarousel from "@/components/HeroCarousel";
import AlbumsSection from "@/components/AlbumsSection";
import AboutSection from "@/components/AboutSection";
import ContactSection from "@/components/ContactSection";
import LoadingScreen from "@/components/LoadingScreen";
import { fetchSiteData, notifyAccess, type SiteData, type FetchedPhoto } from "@/lib/api";

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

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [carouselPhotos, setCarouselPhotos] = useState<FetchedPhoto[]>([]);
  const [imagesReady, setImagesReady] = useState(false);
  const didRunEntryEffects = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchSiteData();
        if (!cancelled) {
          setSiteData(data);
          setCarouselPhotos(data.homePhotos);

          // Preload primeiras 2 imagens do carrossel
          const imagesToPreload = data.homePhotos.slice(0, 2).filter(p => p?.src);
          
          if (imagesToPreload.length > 0) {
            const preloadPromises = imagesToPreload.map(photo => 
              new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => resolve();
                img.src = photo.src;
              })
            );

            await Promise.all(preloadPromises);
            if (!cancelled) {
              setImagesReady(true);
              setLoading(false);
            }
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Error fetching site data:", err);
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
        {loading && <LoadingScreen />}
      </AnimatePresence>

      {!loading && siteData && imagesReady && (
        <main className="min-h-screen bg-background w-full lg:max-w-[800px] lg:mx-auto">
          <Header />
          <HeroCarousel photos={carouselPhotos} enableAutoUpgrade={true} />
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
