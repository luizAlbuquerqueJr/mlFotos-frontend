import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

interface HeroCarouselProps {
  slides: string[];
}

const HeroCarousel = ({ slides }: HeroCarouselProps) => {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    if (slides.length === 0) return;
    setCurrent((p) => (p + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length === 0) return;

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
  }, [next, slides.length]);

  if (slides.length === 0) {
    return <section id="home" className="relative h-screen w-full bg-muted" />;
  }

  return (
    <section id="home" className="relative h-screen w-full overflow-hidden">
      {slides.map((src, index) => (
        <motion.img
          key={src}
          src={src}
          alt={`Slide ${index + 1}`}
          animate={{ opacity: index === current ? 1 : 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ willChange: "opacity" }}
          loading={index === 0 ? "eager" : "eager"}
          decoding="async"
          draggable={false}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background/80" />

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
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
