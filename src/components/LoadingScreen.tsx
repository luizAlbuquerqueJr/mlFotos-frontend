import { motion } from "framer-motion";
import { useEffect } from "react";
import logo from "@/assets/logo.png";

const LOADING_TEXT = "Momentos únicos merecem ser vistos com a melhor qualidade.";
const ANIMATION_DURATION_MS = 2000;
const MIN_LOADING_DURATION_MS = 3000;

interface LoadingScreenProps {
  onComplete?: () => void;
}

const LoadingScreen = ({ onComplete }: LoadingScreenProps) => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (onComplete) onComplete();
    }, MIN_LOADING_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [onComplete]);

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
          className="text-center text-xs sm:text-sm md:text-base text-muted-foreground/70"
        >
          <span className="inline-block overflow-hidden whitespace-nowrap border-r-2 border-muted-foreground/40 pr-1 typewriter-animation">
            {LOADING_TEXT}
          </span>
        </motion.p>
      </div>
      <style>{`
        @keyframes typewriter {
          from {
            width: 0;
          }
          to {
            width: 100%;
          }
        }
        
        @keyframes blink {
          50% {
            border-color: transparent;
          }
        }
        
        .typewriter-animation {
          width: 0;
          animation: 
            typewriter ${ANIMATION_DURATION_MS}ms steps(${LOADING_TEXT.length}) 0.5s forwards,
            blink 0.75s step-end infinite;
        }
      `}</style>
    </motion.div>
  );
};

export default LoadingScreen;
