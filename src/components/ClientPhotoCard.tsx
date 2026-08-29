import { Download } from "lucide-react";
import { FavoriteButton, WatermarkedPhoto } from "@/components/WatermarkedPhoto";
import type { ClientPhoto } from "@/lib/clientPackages";

interface ClientPhotoCardProps {
  photo: ClientPhoto;
  onOpen: () => void;
  onFavorite?: () => void;
  onDownload?: () => void;
}

export function ClientPhotoCard({ photo, onOpen, onFavorite, onDownload }: ClientPhotoCardProps) {
  const isReleased = photo.status === "released";

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/40 bg-muted/10">
      <button type="button" className="block w-full" onClick={onOpen}>
        <WatermarkedPhoto src={photo.previewUrl} alt={photo.name} watermarked={!isReleased} />
      </button>

      {!isReleased && onFavorite && (
        <div className="absolute right-2 top-2 z-10">
          <FavoriteButton active={photo.favorited} onClick={onFavorite} />
        </div>
      )}

      {isReleased && onDownload && (
        <button
          type="button"
          aria-label="Baixar foto"
          className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-2.5 text-white backdrop-blur-sm hover:bg-black/75"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDownload();
          }}
        >
          <Download className="h-4 w-4" />
        </button>
      )}

      {isReleased && (
        <p className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/90">
          Sua foto
        </p>
      )}
      {!isReleased && photo.favorited && onFavorite && (
        <p className="absolute bottom-2 left-2 rounded-full bg-rose-500/90 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white">
          Escolhida
        </p>
      )}
    </div>
  );
}
