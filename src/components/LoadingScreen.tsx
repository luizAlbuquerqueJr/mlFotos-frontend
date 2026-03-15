import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import logo from "@/assets/logo.png";

const LOADING_TEXT = "Momentos únicos merecem ser vistos com a melhor qualidade.";
const MIN_TYPEWRITER_DURATION_MS = 2000;

interface LoadingScreenProps {
  onComplete?: () => void;
}

const LoadingScreen = ({ onComplete }: LoadingScreenProps) => {
  const [visibleCount, setVisibleCount] = useState(0);
  const typingIntervalMs = useMemo(
    () => Math.max(18, Math.floor(MIN_TYPEWRITER_DURATION_MS / LOADING_TEXT.length)),
    []
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVisibleCount((prev) => {
        if (prev >= LOADING_TEXT.length) {
          window.clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, typingIntervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [typingIntervalMs]);

  useEffect(() => {
    if (visibleCount >= LOADING_TEXT.length && onComplete) {
      onComplete();
    }
  }, [visibleCount, onComplete]);

  const shownText = LOADING_TEXT.slice(0, visibleCount);

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
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="max-w-[320px] md:max-w-[560px] px-6 pb-1 text-center text-xs sm:text-sm md:text-base text-muted-foreground/70 leading-relaxed break-words"
      >
        {shownText}
        <span className="inline-block w-[1ch] text-muted-foreground/40" aria-hidden>
          {visibleCount >= LOADING_TEXT.length ? "" : "|"}
        </span>
      </motion.p>
    </motion.div>
  );
};

export default LoadingScreen;
