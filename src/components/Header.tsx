import { useState, useEffect } from "react";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Camera, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
const navItems = [
  { label: "Inicio", href: "#home" },
  { label: "Álbuns", href: "#albuns" },
  { label: "Sobre", href: "#sobre" },
  { label: "Contato", href: "#contato" },
  { label: "Clientes", href: "/clientes" },
];

function isRoute(href: string) {
  return href.startsWith("/");
}

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
        Mônica Lima
      </a>

      {/* Desktop nav */}
      <nav className="hidden md:flex gap-8 text-[13px] font-medium tracking-[0.2em] uppercase">
        {navItems.map((item) => (
          isRoute(item.href) ? (
            <Link
              key={item.href}
              to={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              {item.label}
            </Link>
          ) : (
            <a
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              {item.label}
            </a>
          )
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
          className="absolute top-full left-0 right-0 overflow-hidden bg-background/95 backdrop-blur-lg border-b border-border/30 py-6 flex flex-col items-center gap-6 md:hidden"
        >
          <div className="pointer-events-none absolute inset-0 opacity-[0.08]">
            <div className="grid h-full w-full grid-cols-6 gap-6 p-5">
              {Array.from({ length: 36 }).map((_, index) => (
                <div key={`camera-pattern-${index}`} className="flex items-center justify-center">
                  <Camera className="h-4 w-4 text-foreground/70" strokeWidth={1.5} />
                </div>
              ))}
            </div>
          </div>

          {navItems.map((item) => (
            isRoute(item.href) ? (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMenuOpen(false)}
                className="relative z-10 text-sm tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="relative z-10 text-sm tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            )
          ))}
        </motion.div>
      )}
    </motion.header>
  );
};

export default Header;
