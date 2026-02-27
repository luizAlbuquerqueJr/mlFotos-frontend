import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { FetchedAlbum } from "@/lib/api";

interface PhotoViewerProps {
  album: FetchedAlbum;
  onClose: () => void;
}

const MAX_ZOOM = 3;

const PhotoViewer = ({ album, onClose }: PhotoViewerProps) => {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [showHint, setShowHint] = useState(true);
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

  // Keep refs in sync
  zoomRef.current = zoom;
  panRef.current = pan;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => setShowHint(false), 2500);

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
      document.body.style.overflow = "";
      clearTimeout(timer);
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
    const src = album.photos[photoIndex]?.src?.trim();
    if (src && loadedSrcsRef.current.has(src)) {
      setIsImageLoading(false);
      return;
    }

    setIsImageLoading(true);
  }, [photoIndex, album.id]);

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
      setZoom(2);
      setPan({ x: 0, y: 0 });
    }
  }, [resetZoom]);

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
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button - larger touch target on mobile */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-foreground/60 hover:text-foreground transition-colors z-10 min-w-[44px] min-h-[44px] flex items-center justify-center"
      >
        <X className="w-7 h-7" />
      </button>

      {/* Album title */}
      <div className="absolute top-4 left-4 z-10">
        <h3 className="text-lg text-foreground/80" style={{ fontFamily: "var(--font-serif)" }}>
          {album.title}
        </h3>
      </div>

      {/* Navigation arrows - hidden on mobile */}
      {!isMobile && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground transition-colors z-10"
          >
            <ChevronLeft className="w-10 h-10" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground transition-colors z-10"
          >
            <ChevronRight className="w-10 h-10" />
          </button>
        </>
      )}

      {/* Image container */}
      <div
        ref={containerRef}
        className="relative overflow-hidden max-w-[90vw] max-h-[85vh] flex items-center justify-center border-y border-foreground/20 py-2"
        style={{ touchAction: "none" }}
        onWheel={handleWheel}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isImageLoading && (
          <div className="absolute inset-0 z-[2] flex items-center justify-center bg-black/35">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-foreground/70 border-t-transparent" />
          </div>
        )}

        <motion.img
          ref={imageRef}
          src={album.photos[photoIndex].src}
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
          }}
          className="max-w-[90vw] max-h-[85vh] object-contain select-none"
          draggable={false}
          onLoad={() => {
            const src = album.photos[photoIndex]?.src?.trim();
            if (src) {
              loadedSrcsRef.current.add(src);
            }
            setIsImageLoading(false);
            updateBaseImageSize();
            setPan((prev) => clampPan(prev, zoomRef.current));
          }}
          onError={() => {
            const src = album.photos[photoIndex]?.src?.trim();
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

      {/* Zoom button */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleZoom(); }}
        className="absolute bottom-6 right-6 text-foreground/40 hover:text-foreground transition-colors z-10 min-w-[44px] min-h-[44px] flex items-center justify-center"
      >
        {zoom > 1 ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
      </button>

      {/* Photo counter */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-foreground/40 text-sm tracking-widest">
        {photoIndex + 1} / {album.photos.length}
      </div>

      {/* Mobile hint */}
      {isMobile && showHint && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 text-foreground/30 text-xs tracking-wider text-center"
        >
          Pinça para zoom · Deslize para navegar
        </motion.div>
      )}
    </motion.div>
  );
};

export default PhotoViewer;
