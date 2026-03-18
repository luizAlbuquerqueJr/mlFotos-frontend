import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";

const LOADING_TEXT = "Momentos únicos merecem ser vistos com a melhor qualidade.";
const ANIMATION_DURATION_MS = 2000;
const MIN_LOADING_DURATION_MS = 3000;
const CHARS_PER_STEP = 2;
const STEP_INTERVAL_MS = 50;

interface LoadingScreenProps {
  onComplete?: () => void;
}

const LoadingScreen = ({ onComplete }: LoadingScreenProps) => {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (onComplete) onComplete();
    }, MIN_LOADING_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [onComplete]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVisibleCount((prev) => {
        if (prev >= LOADING_TEXT.length) {
          window.clearInterval(timer);
          return prev;
        }
        return Math.min(prev + CHARS_PER_STEP, LOADING_TEXT.length);
      });
    }, STEP_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <motion.div
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center gap-6 sm:gap-8 overflow-y-auto"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
      }}
    >
      <motion.img
        src={logo}
        alt="Mônica Lima"
        className="w-[80vw] max-w-[420px] h-auto"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      />
      <div className="max-w-[90vw] md:max-w-[600px] px-6">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-center text-xs sm:text-sm md:text-base text-muted-foreground/70 leading-relaxed"
          style={{ willChange: "contents" }}
        >
          {LOADING_TEXT.slice(0, visibleCount)}
          <span 
            className="inline-block w-[1ch] text-muted-foreground/40" 
            aria-hidden
            style={{ 
              willChange: "opacity",
              opacity: visibleCount >= LOADING_TEXT.length ? 0 : 1,
              transition: "opacity 0.15s ease-out"
            }}
          >
            |
          </span>
        </motion.p>
      </div>
    </motion.div>
  );
};

export default LoadingScreen;
