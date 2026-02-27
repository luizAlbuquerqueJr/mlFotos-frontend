import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FetchedAlbum } from "@/lib/api";
import PhotoViewer from "./PhotoViewer";

interface AlbumsSectionProps {
  albums: FetchedAlbum[];
}

const AlbumsSection = ({ albums }: AlbumsSectionProps) => {
  const [openAlbum, setOpenAlbum] = useState<FetchedAlbum | null>(null);
  const [loadedCovers, setLoadedCovers] = useState<Record<string, boolean>>({});

  return (
    <>
      <section id="albuns" className="px-6 md:px-16 lg:px-24 py-24 md:py-32 min-h-screen flex flex-col justify-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-5xl text-center mb-16 tracking-tight"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Álbuns
        </motion.h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto w-full">
          {albums.map((album, i) => (
            <motion.div
              key={album.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "100px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              onClick={() => setOpenAlbum(album)}
              className="group cursor-pointer relative overflow-hidden rounded-sm aspect-[3/4]"
            >
              {!loadedCovers[album.id] && (
                <div className="absolute inset-0 z-[1] flex items-center justify-center bg-background/30">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/60 border-t-transparent" />
                </div>
              )}

              <img
                src={album.cover}
                alt={album.title}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                style={{ opacity: loadedCovers[album.id] ? 1 : 0 }}
                onLoad={() => setLoadedCovers((prev) => ({ ...prev, [album.id]: true }))}
                onError={() => setLoadedCovers((prev) => ({ ...prev, [album.id]: true }))}
              />
              <div className="absolute inset-0 bg-background/40 group-hover:bg-background/20 transition-colors duration-500" />
              <div className="absolute inset-0 flex items-end p-6">
                <div>
                  <h3
                    className="text-xl md:text-2xl text-foreground tracking-wide"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {album.title}
                  </h3>
                  <p className="text-xs text-foreground/50 mt-1 tracking-widest uppercase">
                    {album.photos.length} fotos
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {openAlbum && (
          <PhotoViewer album={openAlbum} onClose={() => setOpenAlbum(null)} />
        )}
      </AnimatePresence>
    </>
  );
};

export default AlbumsSection;
