import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import PhotoViewer from "@/components/PhotoViewer";
import type { FetchedAlbum, FetchedPhoto } from "@/lib/api";

interface HeroCarouselProps {
  photos: FetchedPhoto[];
  enableAutoUpgrade?: boolean;
}

const HeroCarousel = ({ photos, enableAutoUpgrade = true }: HeroCarouselProps) => {
  const [current, setCurrent] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [showDetailCta, setShowDetailCta] = useState(true);
  const [upgradedToOriginal, setUpgradedToOriginal] = useState<Set<number>>(new Set());
  const [dragStart, setDragStart] = useState<number | null>(null);

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

    const processNextBatch = () => {
      if (cancelled) return;

      const nextIndicesToUpgrade: number[] = [];
      
      for (let i = 0; i < photos.length && nextIndicesToUpgrade.length < BATCH_SIZE; i++) {
        if (!upgradedToOriginal.has(i)) {
          const photo = photos[i];
          const originalSrc = photo.originalSrc?.trim();
          const currentSrc = photo.src?.trim();
          if (originalSrc && originalSrc !== currentSrc) {
            nextIndicesToUpgrade.push(i);
          }
        }
      }

      if (nextIndicesToUpgrade.length === 0) return;

      const upgradePromises = nextIndicesToUpgrade.map((index) => {
        const photo = photos[index];
        const originalSrc = photo.originalSrc?.trim();
        if (!originalSrc) return Promise.resolve();

        return new Promise<void>((resolve) => {
          const img = new Image();
          const upgradeImage = async () => {
            try {
              if (typeof img.decode === "function") {
                await img.decode();
              }
            } catch {
              // ignore decode errors
            }
            if (cancelled) {
              resolve();
              return;
            }
            setUpgradedToOriginal((prev) => new Set([...prev, index]));
            resolve();
          };

          img.onload = () => {
            void upgradeImage();
          };
          img.onerror = () => {
            if (!cancelled) {
              setUpgradedToOriginal((prev) => new Set([...prev, index]));
            }
            resolve();
          };
          img.src = originalSrc;
        });
      });

      Promise.all(upgradePromises).then(() => {
        if (!cancelled) {
          processNextBatch();
        }
      });
    };

    processNextBatch();

    return () => {
      cancelled = true;
    };
  }, [photos, upgradedToOriginal, enableAutoUpgrade]);

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
        const src = (isUpgraded && photo.originalSrc) ? photo.originalSrc.trim() : (photo.src?.trim() || "");
        return (
        <motion.div
          key={photo.originalSrc || photo.src || `slide-${index}`}
          animate={{ opacity: index === current ? 1 : 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className={`absolute inset-0 ${index === current ? "z-10 pointer-events-auto" : "z-0 pointer-events-none"}`}
          style={{ willChange: "opacity" }}
        >
          <img
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
