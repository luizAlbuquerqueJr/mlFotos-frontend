import { useState, useEffect } from "react";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, X } from "lucide-react";
const navItems = [
  { label: "Inicio", href: "#home" },
  { label: "Álbuns", href: "#albuns" },
  { label: "Sobre", href: "#sobre" },
  { label: "Contato", href: "#contato" },
];

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? 0;
    if (latest > previous && latest > 100) {
      setHidden(true);
      setMenuOpen(false);
    } else {
      setHidden(false);
    }
  });

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: hidden ? "-100%" : 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 md:px-12 lg:px-16 py-2 bg-background/20 backdrop-blur-sm border-b border-border/5"
    >
      <a href="#home" className="text-lg md:text-xl tracking-[0.15em] uppercase font-medium" style={{ fontFamily: "var(--font-serif)" }}>
        Monica Lima
      </a>

      {/* Desktop nav */}
      <nav className="hidden md:flex gap-8 text-[13px] font-medium tracking-[0.2em] uppercase">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            {item.label}
          </a>
        ))}
      </nav>

      {/* Mobile hamburger */}
      <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-foreground">
        {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile menu */}
      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 bg-background/95 backdrop-blur-lg border-b border-border/30 py-6 flex flex-col items-center gap-6 md:hidden"
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="text-sm tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </a>
          ))}
        </motion.div>
      )}
    </motion.header>
  );
};

export default Header;
