import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface WatermarkedPhotoProps {
  src: string;
  alt: string;
  watermarked?: boolean;
  className?: string;
}

export function WatermarkedPhoto({ src, alt, className }: WatermarkedPhotoProps) {
  return (
    <div className={cn("relative overflow-hidden bg-muted/20", className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="aspect-[4/5] h-full w-full object-cover"
      />
    </div>
  );
}

interface FavoriteButtonProps {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label?: string;
}

export function FavoriteButton({ active, disabled, onClick, label }: FavoriteButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      aria-label={label ?? (active ? "Remover das escolhidas" : "Quero esta foto")}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-sm transition-colors",
        active
          ? "border-rose-300/70 bg-rose-500 text-white"
          : "border-white/30 bg-black/55 text-white hover:bg-black/70",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <Heart className={cn("h-5 w-5", active && "fill-current")} />
    </button>
  );
}
