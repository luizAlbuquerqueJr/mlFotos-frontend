import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import PhotoViewer from "@/components/PhotoViewer";
import type { FetchedAlbum } from "@/lib/api";

interface HeroCarouselProps {
  slides: string[];
}

const HeroCarousel = ({ slides }: HeroCarouselProps) => {
  const [current, setCurrent] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [showDetailCta, setShowDetailCta] = useState(true);

  const viewerAlbum: FetchedAlbum = useMemo(
    () => ({
      id: "home",
      title: "Home",
      cover: slides[0] ?? "",
      photos: slides.map((src, index) => ({ src, alt: `Slide ${index + 1}` })),
    }),
    [slides]
  );

  const next = useCallback(() => {
    if (slides.length === 0) return;
    setCurrent((p) => (p + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length === 0) return;
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
  }, [isViewerOpen, next, slides.length]);

  useEffect(() => {
    const handleScroll = () => {
      setShowDetailCta(window.scrollY <= 8);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (slides.length === 0) {
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
      className="relative w-full overflow-hidden"
      style={{ minHeight: "calc(var(--vh, 1vh) * 100)" }}
    >
      {slides.map((src, index) => (
        <motion.div
          key={src}
          animate={{ opacity: index === current ? 1 : 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className={`absolute inset-0 ${index === current ? "z-10 pointer-events-auto" : "z-0 pointer-events-none"}`}
          style={{ willChange: "opacity" }}
        >
          <img
            src={src}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-60"
            loading={index === 0 ? "eager" : "eager"}
            decoding="async"
            draggable={false}
          />

          <img
            src={src}
            alt={`Slide ${index + 1}`}
            className="absolute inset-0 h-full w-full object-contain md:object-cover"
            loading={index === 0 ? "eager" : "eager"}
            decoding="async"
            draggable={false}
          />
        </motion.div>
      ))}

      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background/60 via-transparent to-background/80" />

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
        {slides.map((_, i) => (
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
