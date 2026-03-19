import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import PhotoViewer from "@/components/PhotoViewer";
import type { FetchedAlbum, FetchedPhoto } from "@/lib/api";

interface HeroCarouselProps {
  photos: FetchedPhoto[];
  enableAutoUpgrade?: boolean;
}

// Cache global de Blob URLs para imagens originais
const originalBlobCache = new Map<string, string>();

const HeroCarousel = ({ photos, enableAutoUpgrade = true }: HeroCarouselProps) => {
  const [current, setCurrent] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [showDetailCta, setShowDetailCta] = useState(true);
  const [upgradedToOriginal, setUpgradedToOriginal] = useState<Set<number>>(new Set());
  const [dragStart, setDragStart] = useState<number | null>(null);
  const imgRefs = useRef<Map<number, HTMLImageElement>>(new Map());

  const viewerAlbum: FetchedAlbum = useMemo(
    () => ({
      id: "home",
      title: "Home",
      cover: photos[0]?.src ?? "",
      photos: photos.map((photo, index) => ({
        src: photo.src,
        alt: photo.alt || `Slide ${index + 1}`,
        originalSrc: photo.originalSrc,
        previewSrc: photo.previewSrc,
        thumbSrc: photo.thumbSrc,
      })),
    }),
    [photos]
  );

  const next = useCallback(() => {
    if (photos.length === 0) return;
    setCurrent((p) => (p + 1) % photos.length);
  }, [photos.length]);

  const prev = useCallback(() => {
    if (photos.length === 0) return;
    setCurrent((p) => (p - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setDragStart(clientX);
  }, []);

  const handleDragEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (dragStart === null) return;
    
    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
    const diff = dragStart - clientX;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        next();
      } else {
        prev();
      }
    }

    setDragStart(null);
  }, [dragStart, next, prev]);

  useEffect(() => {
    if (photos.length === 0) return;
    if (isViewerOpen) return;

    let cancelled = false;
    let timeoutId: number | null = null;

    const schedule = () => {
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        next();
        schedule();
      }, 5000);
    };

    schedule();

    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [isViewerOpen, next, photos.length]);

  useEffect(() => {
    const handleScroll = () => {
      setShowDetailCta(window.scrollY <= 8);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (photos.length === 0) return;
    if (!enableAutoUpgrade) return;

    let cancelled = false;
    const BATCH_SIZE = 2;

    const processNextBatch = async () => {
      if (cancelled) return;

      // Cria lista de índices, pulando atual + 2 próximas (offset 3+)
      const indicesToUpgrade: number[] = [];
      
      // Adiciona slides a partir do 3º à frente (current+3, current+4, ...)
      // Pula: current, current+1, current+2
      for (let offset = 3; offset < photos.length; offset++) {
        const index = (current + offset) % photos.length;
        if (!upgradedToOriginal.has(index)) {
          const photo = photos[index];
          const originalSrc = photo.originalSrc?.trim();
          const currentSrc = photo.src?.trim();
          if (originalSrc && originalSrc !== currentSrc) {
            indicesToUpgrade.push(index);
          }
        }
      }

      // Pega apenas BATCH_SIZE imagens
      const nextIndicesToUpgrade = indicesToUpgrade.slice(0, BATCH_SIZE);

      if (nextIndicesToUpgrade.length === 0) return;

      // Upgrade usando fetch + Blob URL para evitar downloads duplicados
      const upgradePromises = nextIndicesToUpgrade.map(async (index) => {
        const photo = photos[index];
        const originalSrc = photo.originalSrc?.trim();
        if (!originalSrc) return;

        // Verifica se já está no cache global
        if (originalBlobCache.has(originalSrc)) {
          const cachedBlobUrl = originalBlobCache.get(originalSrc)!;
          photos[index] = {
            ...photo,
            originalSrc: cachedBlobUrl,
          };
          if (!cancelled) {
            setUpgradedToOriginal((prev) => new Set([...prev, index]));
          }
          return;
        }

        try {
          // Baixa como blob
          const response = await fetch(originalSrc);
          if (!response.ok) {
            if (!cancelled) {
              setUpgradedToOriginal((prev) => new Set([...prev, index]));
            }
            return;
          }

          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);

          // Armazena no cache global
          originalBlobCache.set(originalSrc, blobUrl);

          // Precarrega e decodifica
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = blobUrl;
          });

          if (typeof img.decode === "function") {
            await img.decode();
          }

          if (cancelled) return;

          // Atualiza foto com Blob URL
          photos[index] = {
            ...photo,
            originalSrc: blobUrl,
          };

          setUpgradedToOriginal((prev) => new Set([...prev, index]));
        } catch (err) {
          if (!cancelled) {
            setUpgradedToOriginal((prev) => new Set([...prev, index]));
          }
        }
      });

      await Promise.all(upgradePromises);
      
      if (!cancelled) {
        processNextBatch();
      }
    };

    processNextBatch();

    return () => {
      cancelled = true;
    };
  }, [photos, upgradedToOriginal, enableAutoUpgrade, current]);

  if (photos.length === 0) {
    return (
      <section
        id="home"
        className="relative w-full bg-muted"
        style={{ minHeight: "calc(var(--vh, 1vh) * 100)" }}
      />
    );
  }

  return (
    <section
      id="home"
      className="relative w-full overflow-hidden cursor-grab active:cursor-grabbing"
      style={{ minHeight: "calc(var(--vh, 1vh) * 100)" }}
      onMouseDown={handleDragStart}
      onMouseUp={handleDragEnd}
      onMouseLeave={() => setDragStart(null)}
      onTouchStart={handleDragStart}
      onTouchEnd={handleDragEnd}
    >
      {photos.map((photo, index) => {
        const isUpgraded = upgradedToOriginal.has(index);
        const src = (isUpgraded && photo.originalSrc) 
          ? photo.originalSrc.trim() 
          : (photo.previewSrc?.trim() || photo.src?.trim() || "");
        return (
        <motion.div
          key={photo.originalSrc || photo.src || `slide-${index}`}
          animate={{ opacity: index === current ? 1 : 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className={`absolute inset-0 ${index === current ? "z-10 pointer-events-auto" : "z-0 pointer-events-none"}`}
          style={{ willChange: "opacity" }}
        >
          <img
            ref={(el) => {
              if (el && !imgRefs.current.has(index)) {
                imgRefs.current.set(index, el);
              }
            }}
            src={src}
            alt={photo.alt || `Slide ${index + 1}`}
            className="absolute inset-0 h-full w-full object-contain md:object-cover"
            loading={index === 0 || index === 1 ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
            fetchPriority={index === 0 ? "high" : "low"}
          />
        </motion.div>
        );
      })}

      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background/60 via-transparent to-background/80 backdrop-blur-sm" />

      <div
        className={`absolute left-1/2 -translate-x-1/2 z-20 transition-all duration-300 ${
          showDetailCta ? "bottom-16 opacity-100 pointer-events-auto" : "bottom-14 opacity-0 pointer-events-none"
        }`}
      >
        <button
          onClick={() => {
            setViewerInitialIndex(current);
            setIsViewerOpen(true);
          }}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-foreground/30 bg-background/35 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.16em] text-foreground backdrop-blur-md transition-all duration-300 hover:border-foreground/60 hover:bg-background/55"
        >
          Ver foto em detalhe
          <span aria-hidden>↗</span>
        </button>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        {photos.map((_, i) => (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              setCurrent(i);
            }}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === current ? "bg-foreground w-6" : "bg-foreground/30"
            }`}
          />
        ))}
      </div>

      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10"
      >
        <div className="w-[1px] h-10 bg-foreground/30" />
      </motion.div>

      {isViewerOpen && (
        <PhotoViewer
          album={viewerAlbum}
          initialPhotoIndex={viewerInitialIndex}
          onClose={() => {
            setIsViewerOpen(false);
          }}
        />
      )}
    </section>
  );
};

export default HeroCarousel;
