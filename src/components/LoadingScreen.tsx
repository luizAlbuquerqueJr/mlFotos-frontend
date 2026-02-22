import { motion } from "framer-motion";
import logo from "@/assets/logo.jpg";

const LoadingScreen = ({ onFinish }: { onFinish: () => void }) => {
  return (
    <motion.div
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center gap-8"
    >
      <motion.img
        src={logo}
        alt="Mônica Lima"
        className="h-16 w-auto"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      />
      <div className="w-48 h-[1px] bg-border overflow-hidden">
        <motion.div
          className="h-full bg-foreground/60"
          initial={{ width: "0%" }}
          animate={{ width: "90%" }}
          transition={{ duration: 4, ease: "easeOut" }}
        />
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="text-xs text-muted-foreground/50 tracking-widest uppercase"
      >
        Carregando...
      </motion.p>
    </motion.div>
  );
};

export default LoadingScreen;
