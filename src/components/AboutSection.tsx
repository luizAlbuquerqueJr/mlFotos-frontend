import { forwardRef } from "react";
import { motion } from "framer-motion";

interface AboutSectionProps {
  photoUrl?: string | null;
}

const AboutSection = forwardRef<HTMLElement, AboutSectionProps>(({ photoUrl }, ref) => {
  return (
    <section ref={ref} id="sobre" className="px-6 md:px-16 lg:px-24 py-24 md:py-32 border-t border-border/50 min-h-screen flex items-center">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="aspect-[3/4] bg-muted overflow-hidden rounded-sm"
        >
          <img
            src={photoUrl || ""}
            alt="Monica Lima — fotógrafa"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="space-y-5"
        >
          <h2
            className="text-3xl md:text-5xl tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Sobre
          </h2>
          <div className="w-10 h-[1px] bg-foreground/20" />
          <p className="text-muted-foreground leading-relaxed text-[15px] md:text-base">
            Monica Lima é uma fotógrafa apaixonada por capturar momentos autênticos e transformá-los em narrativas visuais.
            Com um olhar sensível para luz, textura e emoção, seu trabalho transita entre retratos intimistas,
            paisagens urbanas e cenas do cotidiano.
          </p>
          <p className="text-muted-foreground leading-relaxed text-[15px] md:text-base">
            Cada imagem é um convite para ver o mundo sob uma nova perspectiva —
            onde o ordinário revela sua beleza escondida e cada instante conta uma história única.
          </p>
          <p className="text-xs text-muted-foreground/40 tracking-widest uppercase pt-3 font-medium">
            São Paulo, Brasil
          </p>
        </motion.div>
      </div>
    </section>
  );
});

AboutSection.displayName = "AboutSection";

export default AboutSection;
