import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface HeroCarouselProps {
  slides: string[];
}

const HeroCarousel = ({ slides }: HeroCarouselProps) => {
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const next = useCallback(() => {
    if (slides.length === 0) return;
    setCurrent((p) => (p + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length === 0) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next, slides.length]);

  useEffect(() => {
    if (slides.length === 0) return;
    setLoaded(false);
  }, [current, slides.length]);

  if (slides.length === 0) {
    return <section id="home" className="relative h-screen w-full bg-muted" />;
  }

  return (
    <section id="home" className="relative h-screen w-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.img
          key={current}
          src={slides[current]}
          alt={`Slide ${current + 1}`}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: loaded ? 1 : 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="absolute inset-0 w-full h-full object-cover"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      </AnimatePresence>

      {!loaded && (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-background/25">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-foreground/60 border-t-transparent" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background/80" />

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrent(i); setLoaded(false); }}
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
    </section>
  );
};

export default HeroCarousel;
