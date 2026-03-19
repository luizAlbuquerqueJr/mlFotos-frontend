import { useState, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import HeroCarousel from "@/components/HeroCarousel";
import AlbumsSection from "@/components/AlbumsSection";
import AboutSection from "@/components/AboutSection";
import ContactSection from "@/components/ContactSection";
import LoadingScreen from "@/components/LoadingScreen";
import { fetchSiteData, notifyAccess, type SiteData, type FetchedPhoto } from "@/lib/api";

// Cache global: mapeia URL original -> Blob URL
const blobUrlCache = new Map<string, string>();

async function preloadImageAsBlob(src: string): Promise<string | null> {
  // Se já está em cache, retorna Blob URL
  if (blobUrlCache.has(src)) {
    return blobUrlCache.get(src)!;
  }

  try {
    // Baixa imagem como blob
    const response = await fetch(src);
    if (!response.ok) return null;
    
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    // Armazena mapeamento
    blobUrlCache.set(src, blobUrl);
    
    // Precarrega para decodificar
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = blobUrl;
    });
    
    if (typeof img.decode === "function") {
      await img.decode();
    }
    
    return blobUrl;
  } catch (err) {
    console.error("Error preloading image:", err);
    return null;
  }
}

const MIN_LOADING_DURATION_MS = 3000;

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [carouselPhotos, setCarouselPhotos] = useState<FetchedPhoto[]>([]);
  const [imagesReady, setImagesReady] = useState(false);
  const [typewriterComplete, setTypewriterComplete] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const didRunEntryEffects = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMinTimeElapsed(true);
    }, MIN_LOADING_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchSiteData();
        if (!cancelled) {
          setSiteData(data);
          setCarouselPhotos(data.homePhotos);

          // Preload primeiras 2 imagens do carrossel (preview) como Blob URLs
          const imagesToPreload = data.homePhotos.slice(0, 2);
          
          if (imagesToPreload.length > 0) {
            // Carregar imagens como blobs e obter Blob URLs
            const blobUrls = await Promise.all(
              imagesToPreload.map(photo => 
                preloadImageAsBlob(photo.previewSrc || photo.src)
              )
            );

            // Atualizar fotos com Blob URLs
            const updatedPhotos = data.homePhotos.map((photo, index) => {
              if (index < 2 && blobUrls[index]) {
                return {
                  ...photo,
                  previewSrc: blobUrls[index]!, // Usa Blob URL
                  _originalPreviewSrc: photo.previewSrc, // Guarda original
                };
              }
              return photo;
            });

            if (!cancelled) {
              setCarouselPhotos(updatedPhotos);
              setImagesReady(true);
            }
          } else {
            setImagesReady(true);
          }
        }
      } catch (err) {
        console.error("Error fetching site data:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (imagesReady && typewriterComplete && minTimeElapsed) {
      setLoading(false);
    }
  }, [imagesReady, typewriterComplete, minTimeElapsed]);

  useEffect(() => {
    if (didRunEntryEffects.current) return;
    didRunEntryEffects.current = true;

    notifyAccess(window.location.pathname)
      .catch((err) => console.error("Error notifying access:", err));
  }, []);

  return (
    <>
      <AnimatePresence>
        {loading && <LoadingScreen onComplete={() => setTypewriterComplete(true)} />}
      </AnimatePresence>

      {!loading && siteData && imagesReady && (
        <main className="min-h-screen bg-background w-full lg:max-w-[800px] lg:mx-auto">
          <Header />
          <HeroCarousel photos={carouselPhotos} enableAutoUpgrade={false} />
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
