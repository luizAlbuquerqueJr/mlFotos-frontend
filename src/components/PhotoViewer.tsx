import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { FetchedAlbum } from "@/lib/api";
import qualidadeAltaSfx from "../../assets/qualidade_alta.wav";

interface PhotoViewerProps {
  album: FetchedAlbum;
  onClose: () => void;
  initialPhotoIndex?: number;
}

const MAX_ZOOM = 5;

const PhotoViewer = ({ album, onClose, initialPhotoIndex = 0 }: PhotoViewerProps) => {
  const safeInitialIndex =
    Number.isInteger(initialPhotoIndex) && initialPhotoIndex >= 0 && initialPhotoIndex < album.photos.length
      ? initialPhotoIndex
      : 0;

  const [photoIndex, setPhotoIndex] = useState(safeInitialIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [useOriginalQuality, setUseOriginalQuality] = useState(false);
  const isMobile = useIsMobile();

  const loadedSrcsRef = useRef<Set<string>>(new Set());

  // Pointer (desktop) refs
  const isDragging = useRef(false);
  const isTouchInteracting = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  // Touch refs
  const lastTouchDistance = useRef(0);
  const lastTapTime = useRef(0);
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const touchPanStart = useRef({ x: 0, y: 0 });
  const touchStartPan = useRef({ x: 0, y: 0 });
  const isPinching = useRef(false);
  const hasMoved = useRef(false);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const baseImageSizeRef = useRef({ width: 0, height: 0 });
  const qualityAudioRef = useRef<HTMLAudioElement | null>(null);

  // Keep refs in sync
  zoomRef.current = zoom;
  panRef.current = pan;

  const currentPhoto = album.photos[photoIndex];
  const hasOriginalQuality = Boolean(currentPhoto?.originalSrc?.trim());
  const displayedSrc =
    useOriginalQuality && hasOriginalQuality
      ? currentPhoto.originalSrc.trim()
      : currentPhoto?.src?.trim() || "";
  const isHighQualityLoading = isImageLoading && useOriginalQuality && hasOriginalQuality;

  useEffect(() => {
    const scrollY = window.scrollY;
    const prev = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    // Preload album photos once on open to maximize cache hits when navigating.
    // We resolve on error too to avoid blocking.
    for (const photo of album.photos) {
      const src = photo.src?.trim();
      if (!src || loadedSrcsRef.current.has(src)) continue;
      const img = new Image();
      img.onload = () => loadedSrcsRef.current.add(src);
      img.onerror = () => loadedSrcsRef.current.add(src);
      img.src = src;
    }

    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;

      const top = document.body.style.top;
      const restored = top ? Number(top.replace("-", "").replace("px", "")) : scrollY;
      window.scrollTo(0, restored || 0);
    };
  }, [album.photos]);

  useEffect(() => {
    qualityAudioRef.current = new Audio(qualidadeAltaSfx);
    qualityAudioRef.current.preload = "auto";

    return () => {
      if (qualityAudioRef.current) {
        qualityAudioRef.current.pause();
        qualityAudioRef.current = null;
      }
    };
  }, []);

  const clampPan = useCallback((nextPan: { x: number; y: number }, nextZoom: number) => {
    if (nextZoom <= 1) return { x: 0, y: 0 };

    const container = containerRef.current;
    const baseSize = baseImageSizeRef.current;
    if (!container || !baseSize.width || !baseSize.height) return nextPan;

    const containerRect = container.getBoundingClientRect();
    const maxX = Math.max(0, (baseSize.width * nextZoom - containerRect.width) / 2);
    const maxY = Math.max(0, (baseSize.height * nextZoom - containerRect.height) / 2);

    return {
      x: Math.min(maxX, Math.max(-maxX, nextPan.x)),
      y: Math.min(maxY, Math.max(-maxY, nextPan.y)),
    };
  }, []);

  const updateBaseImageSize = useCallback(() => {
    const image = imageRef.current;
    if (!image) return;

    const rect = image.getBoundingClientRect();
    const currentZoom = Math.max(zoomRef.current, 1);

    baseImageSizeRef.current = {
      width: rect.width / currentZoom,
      height: rect.height / currentZoom,
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      updateBaseImageSize();
      setPan((prev) => clampPan(prev, zoomRef.current));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPan, updateBaseImageSize]);

  useEffect(() => {
    const src = displayedSrc;
    if (src && loadedSrcsRef.current.has(src)) {
      setIsImageLoading(false);
      return;
    }

    setIsImageLoading(true);
  }, [photoIndex, album.id, displayedSrc]);

  useEffect(() => {
    setUseOriginalQuality(false);
  }, [photoIndex]);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const goNext = useCallback(() => {
    resetZoom();
    setPhotoIndex((p) => (p + 1) % album.photos.length);
  }, [album.photos.length, resetZoom]);

  const goPrev = useCallback(() => {
    resetZoom();
    setPhotoIndex((p) => (p - 1 + album.photos.length) % album.photos.length);
  }, [album.photos.length, resetZoom]);

  const toggleZoom = useCallback(() => {
    if (zoomRef.current > 1) {
      resetZoom();
    } else {
      setZoom(2.5);
      setPan({ x: 0, y: 0 });
    }
  }, [resetZoom]);

  const playHighQualitySound = useCallback(() => {
    const audio = qualityAudioRef.current;
    if (!audio) return;

    try {
      audio.currentTime = 0;
      const promise = audio.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch(() => {
          // ignore autoplay/gesture restrictions
        });
      }
    } catch {
      // ignore audio runtime errors to avoid breaking UX
    }
  }, []);

  // --- Desktop handlers ---
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    const newZoom = Math.min(MAX_ZOOM, Math.max(1, zoomRef.current - e.deltaY * 0.002));
    if (newZoom === 1) {
      setPan({ x: 0, y: 0 });
    } else {
      setPan((prev) => clampPan(prev, newZoom));
    }
    setZoom(newZoom);
  }, [clampPan]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "touch") return; // handled by touch events
    if (zoomRef.current <= 1) return;
    e.stopPropagation();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...panRef.current };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    if (!isDragging.current) return;
    e.stopPropagation();
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan(clampPan({ x: panStart.current.x + dx, y: panStart.current.y + dy }, zoomRef.current));
  }, [clampPan]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // --- Touch handlers ---
  const getTouchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    hasMoved.current = false;
    isTouchInteracting.current = true;

    if (e.touches.length === 2) {
      isPinching.current = true;
      lastTouchDistance.current = getTouchDistance(e.touches);
    } else if (e.touches.length === 1) {
      isPinching.current = false;
      swipeStartX.current = e.touches[0].clientX;
      swipeStartY.current = e.touches[0].clientY;
      touchPanStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchStartPan.current = { ...panRef.current };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    hasMoved.current = true;
    isTouchInteracting.current = true;

    if (e.touches.length === 2 && isPinching.current) {
      const newDist = getTouchDistance(e.touches);
      const scale = newDist / lastTouchDistance.current;
      const newZoom = Math.min(MAX_ZOOM, Math.max(1, zoomRef.current * scale));
      lastTouchDistance.current = newDist;
      if (newZoom === 1) {
        setPan({ x: 0, y: 0 });
      } else {
        setPan((prev) => clampPan(prev, newZoom));
      }
      setZoom(newZoom);
    } else if (e.touches.length === 1 && !isPinching.current && zoomRef.current > 1) {
      const dx = e.touches[0].clientX - touchPanStart.current.x;
      const dy = e.touches[0].clientY - touchPanStart.current.y;
      setPan(clampPan({ x: touchStartPan.current.x + dx, y: touchStartPan.current.y + dy }, zoomRef.current));
    }
  }, [clampPan]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();

    if (isPinching.current && e.touches.length < 2) {
      isPinching.current = false;
      return;
    }

    if (e.touches.length > 0) return;
    isTouchInteracting.current = false;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime.current;

    // Double-tap detection
    if (!hasMoved.current && timeSinceLastTap < 300) {
      lastTapTime.current = 0;
      toggleZoom();
      return;
    }
    lastTapTime.current = now;

    // Swipe detection (only when not zoomed)
    if (zoomRef.current <= 1 && !isPinching.current) {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - swipeStartX.current;
      const dy = endY - swipeStartY.current;

      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) goNext();
        else goPrev();
      }
    }
  }, [toggleZoom, goNext, goPrev]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 bg-black flex items-stretch justify-center p-0"
      onClick={onClose}
    >
      <div className="z-10 flex h-full w-full min-h-0 flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="relative w-full px-2 pt-3 pb-1">
          <div className="flex w-full items-center justify-center gap-2">
            <span className="whitespace-nowrap text-[11px] font-semibold tracking-widest text-foreground/60">Qualidade</span>
            <div className="flex overflow-hidden rounded-full border border-foreground/30 bg-black/40 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setUseOriginalQuality(false)}
                className={`min-h-[26px] px-2 text-[12px] sm:text-[14px] font-semibold tracking-wide transition-colors ${
                  !useOriginalQuality ? "bg-foreground text-background" : "text-foreground/80 hover:text-foreground"
                }`}
              >
                Média
              </button>
              <button
                type="button"
                onClick={() => {
                  playHighQualitySound();
                  setUseOriginalQuality(true);
                }}
                disabled={!hasOriginalQuality}
                className={`min-h-[26px] px-2 text-[12px] sm:text-[14px] font-semibold tracking-wide transition-colors ${
                  useOriginalQuality ? "bg-foreground text-background" : "text-foreground/80 hover:text-foreground"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Máxima 💎
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/60 hover:text-foreground transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
            type="button"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image container */}
        <div
          ref={containerRef}
          className="relative min-h-0 flex-1 w-full overflow-hidden flex items-center justify-center border-y border-foreground/20"
          style={{ touchAction: "none" }}
          onWheel={handleWheel}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
        {isImageLoading && (
          <div className="absolute inset-0 z-[2] flex items-center justify-center bg-black/35">
            <div className="mx-4 max-w-xl rounded-xl bg-black/45 p-4 md:p-5 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-foreground/70 border-t-transparent" />
              {isHighQualityLoading && (
                <p className="mt-3 text-xs md:text-sm leading-relaxed text-foreground/90">
                  Você verá sua foto na melhor qualidade disponível. Por se tratar de uma imagem de alta resolução, o carregamento pode levar alguns instantes. Para evitar consumo elevado de dados, recomendamos utilizar uma conexão Wi-Fi.
                </p>
              )}
            </div>
          </div>
        )}

          <motion.img
            ref={imageRef}
            src={displayedSrc}
            alt={album.photos[photoIndex].alt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              cursor: zoom > 1 ? "grab" : "zoom-in",
              transition: isDragging.current || isTouchInteracting.current ? "none" : "transform 0.2s ease",
              touchAction: "none",
              opacity: isImageLoading ? 0 : 1,
              visibility: isImageLoading ? "hidden" : "visible",
            }}
            className="h-full w-full object-contain select-none"
            draggable={false}
            onLoad={() => {
              const src = displayedSrc;
              if (src) {
                loadedSrcsRef.current.add(src);
              }
              setIsImageLoading(false);
              updateBaseImageSize();
              setPan((prev) => clampPan(prev, zoomRef.current));
            }}
            onError={() => {
              const src = displayedSrc;
              if (src) {
                loadedSrcsRef.current.add(src);
              }
              setIsImageLoading(false);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!isMobile && !isDragging.current) toggleZoom();
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>

        <div className="m-1 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            className="min-h-[32px] min-w-[32px] text-foreground/65 hover:text-foreground transition-colors flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-foreground/50 text-[11px] tracking-widest min-w-[58px] text-center">
            {photoIndex + 1} / {album.photos.length}
          </div>
          <button
            type="button"
            onClick={goNext}
            className="min-h-[32px] min-w-[32px] text-foreground/65 hover:text-foreground transition-colors flex items-center justify-center"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Zoom button */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleZoom(); }}
        className="absolute bottom-6 right-6 text-foreground/40 hover:text-foreground transition-colors z-10 min-w-[44px] min-h-[44px] flex items-center justify-center"
      >
        {zoom > 1 ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
      </button>

      {/* Mobile hint removed */}
    </motion.div>
  );
};

export default PhotoViewer;
