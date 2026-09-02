import { useEffect, useMemo, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientPhotoCard } from "@/components/ClientPhotoCard";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { CouponTicket } from "@/components/CouponTicket";
import PhotoViewer from "@/components/PhotoViewer";
import {
  canSelectPhotos,
  formatBRL,
  quoteSelection,
  type ClientPackage,
  type ClientPhoto,
  type SelectionQuote,
} from "@/lib/clientPackages";

interface ClientPhotosExperienceProps {
  client: ClientPackage;
  onToggleFavorite: (photoId: string) => void;
  onNotifyWhatsApp: () => void;
  onDownload: (photo: ClientPhoto) => void;
  onDownloadAllOwned: () => void;
}

function buildEncouragement(client: ClientPackage, quote: SelectionQuote, hasOwnedPhotos: boolean) {
  const remainingInBook = client.photos.filter((photo) => photo.status === "selectable" && !photo.favorited).length;
  const current = formatBRL(quote.couponValue);
  const next = formatBRL(quote.nextCouponValue);
  const growing = quote.couponValue > 0;

  let stickyNote: string | null = null;
  let stickyTone: "warm" | "nudge" | "eager" | "success" | "warn" = "warm";

  if (!quote.canSubmit && !hasOwnedPhotos) {
    const remaining = quote.minRequired - quote.selectedCount;
    stickyNote =
      remaining === 1
        ? "Falta 1 coração para completar o seu pacote. Depois disso, se quiser, você ainda pode levar mais."
        : `Faltam ${remaining} fotos para o seu pacote. Escolha com o coração — e se alguma outra te prender, pode levar extra.`;
    stickyTone = "warn";
  } else if (quote.hasExtraDiscount && quote.extrasInDiscountCycle === 1 && quote.extraCount > 0) {
    stickyNote = growing
      ? `Você já tem um cupom de ${current}. Se levar mais, ele pode crescer.`
      : "Um cupom apareceu. Se o coração pedir mais, ele começa a se mexer.";
    stickyTone = "warm";
  } else if (quote.justUnlockedCoupon) {
    stickyNote =
      quote.couponValue > quote.extraDiscountValue
        ? `Agora o cupom é de ${current}. Se o coração pedir mais, ele ainda pode crescer.`
        : `Seu cupom agora é de ${current}. Se você levar mais, ele pode ficar maior.`;
    stickyTone = "success";
  } else if (quote.hasExtraDiscount && quote.extraCount > 0 && quote.extrasUntilDiscount === 1) {
    stickyNote = growing
      ? `Falta 1 extra e o cupom vira ${next}. Ele está tremendo pra crescer.`
      : `Falta 1 extra! Esse cupom de ${next} está tremendo pra cair na sua seleção.`;
    stickyTone = "eager";
  } else if (quote.hasExtraDiscount && quote.extraCount > 0 && quote.extrasUntilDiscount === 2) {
    stickyNote = growing
      ? `O cupom quer virar ${next}. Só mais um pouquinho.`
      : `Olha o cupom se mexendo. Leva mais um pouco e ${next} saem do valor.`;
    stickyTone = "eager";
  } else if (quote.hasExtraDiscount && quote.extraCount > 0 && quote.extrasUntilDiscount <= 4) {
    stickyNote = growing
      ? `Seu cupom hoje é de ${current}. Continue escolhendo e ele pode virar ${next}.`
      : `Tem um cupom se mexendo. Quanto mais você guarda, mais perto ele chega.`;
    stickyTone = "nudge";
  } else if (quote.canSubmit && quote.extraCount === 0 && remainingInBook > 0) {
    stickyNote = `Suas ${client.contract.contractedCount} do contrato estão escolhidas. Pode avisar no WhatsApp agora — mas se alguma outra te prender, leva extra. Um cupom pode aparecer, e ele cresce com você.`;
    stickyTone = "nudge";
  } else if (quote.extraCount > 0 && quote.hasExtraDiscount) {
    stickyNote = growing
      ? `Você já tem um cupom de ${current}. Se levar mais, ele pode crescer.`
      : "Que bom que você não deixou essa foto pra trás. Se o coração apertar em mais alguma, um cupom pode aparecer.";
    stickyTone = "warm";
  } else if (quote.extraCount > 0) {
    stickyNote = "Que bom que você não deixou essa foto pra trás. Se o coração apertar em mais alguma, leva junto.";
    stickyTone = "warm";
  }

  return { stickyNote, stickyTone, remainingInBook };
}

export function ClientPhotosExperience({
  client,
  onToggleFavorite,
  onNotifyWhatsApp,
  onDownload,
  onDownloadAllOwned,
}: ClientPhotosExperienceProps) {
  const [viewerPhotos, setViewerPhotos] = useState<ClientPhoto[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  const owned = useMemo(
    () => client.photos.filter((photo) => photo.status === "released"),
    [client.photos]
  );
  const book = useMemo(
    () => client.photos.filter((photo) => photo.status === "selectable"),
    [client.photos]
  );
  const canSelect = canSelectPhotos(client);
  const quote = quoteSelection(client);
  const hasOwnedPhotos = owned.length > 0;
  const encouragement = buildEncouragement(client, quote, hasOwnedPhotos);
  const showCoupon = quote.hasExtraDiscount && quote.extraCount > 0;
  const lastCouponCount = useRef<number | null>(null);
  const [confettiToken, setConfettiToken] = useState(0);

  useEffect(() => {
    if (lastCouponCount.current === null) {
      lastCouponCount.current = quote.couponCount;
      return;
    }
    if (quote.couponCount > lastCouponCount.current) {
      setConfettiToken((token) => token + 1);
    }
    lastCouponCount.current = quote.couponCount;
  }, [quote.couponCount]);

  const discountProgress = quote.justUnlockedCoupon
    ? 100
    : quote.extraDiscountEvery > 0
      ? Math.round((quote.extrasInDiscountCycle / quote.extraDiscountEvery) * 100)
      : 0;

  const album = useMemo(() => {
    if (!viewerPhotos?.length) return null;
    return {
      id: client.id,
      title: `Fotos de ${client.name}`,
      cover: viewerPhotos[0]?.previewUrl ?? "",
      photos: viewerPhotos.map((photo) => ({
        src: photo.previewUrl,
        originalSrc: !canSelect || photo.status === "released" ? photo.originalUrl : "",
        alt: photo.name,
      })),
    };
  }, [canSelect, client.id, client.name, viewerPhotos]);

  const openViewer = (photos: ClientPhoto[], photo: ClientPhoto) => {
    setViewerPhotos(photos);
    setViewerIndex(Math.max(0, photos.findIndex((item) => item.id === photo.id)));
  };

  const toneClass = {
    warm: "text-muted-foreground",
    nudge: "text-amber-200",
    eager: "coupon-note-eager text-amber-100",
    success: "text-emerald-300",
    warn: "text-amber-200",
  }[encouragement.stickyTone];

  if (!canSelect) {
    return (
      <div className="space-y-8">
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Seu book</p>
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            Olá, {client.name.split(" ")[0]}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Toque na foto para ampliar.
            {client.photos.length > 0 ? ` Seu book tem ${client.photos.length} fotos.` : ""}
          </p>
        </section>

        {client.photos.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {client.photos.map((photo) => (
              <ClientPhotoCard
                key={photo.id}
                photo={photo}
                onOpen={() => openViewer(client.photos, photo)}
                onDownload={photo.status === "released" ? () => onDownload(photo) : undefined}
              />
            ))}
          </div>
        )}

        {album && viewerPhotos && (
          <PhotoViewer album={album} onClose={() => setViewerPhotos(null)} initialPhotoIndex={viewerIndex} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ConfettiBurst playToken={confettiToken} />
      <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Seu book</p>
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            Olá, {client.name.split(" ")[0]}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {hasOwnedPhotos ? (
              <>
                As fotos que já são suas estão aqui, prontas para baixar. Se ainda ficou alguma no peito, o book
                continua embaixo — pode levar mais. Você só paga as extras (
                {formatBRL(client.contract.extraPhotoPrice)} cada).
                {quote.hasExtraDiscount
                  ? ` Quanto mais extras você levar, maior pode ficar o cupom.`
                  : ""}
              </>
            ) : (
              <>
                Seu book tem <span className="text-foreground font-medium">{client.photos.length} fotos</span>. As{" "}
                <span className="text-foreground font-medium">{client.contract.contractedCount}</span> do contrato já
                estão pagas ({formatBRL(client.contract.contractedPrice)}). Agora é só escolher quais são. Se o coração
                apertar em mais alguma, você leva extra — e paga só o que passar das{" "}
                {client.contract.contractedCount}. Cada extra fica {formatBRL(client.contract.extraPhotoPrice)}.
                {quote.hasExtraDiscount
                  ? ` E se você levar extra, um cupom pode aparecer — quanto mais guarda, maior ele fica.`
                  : ""}
              </>
            )}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-border/50 bg-background/40 p-3">
            <p className="text-muted-foreground">Contrato (já pago)</p>
            <p className="mt-1 text-lg text-foreground">
              {client.contract.contractedCount} fotos ·{" "}
              <span className="text-muted-foreground line-through">{formatBRL(client.contract.contractedPrice)}</span>
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/40 p-3">
            <p className="text-muted-foreground">Pode levar mais</p>
            <p className="mt-1 text-lg text-foreground">{formatBRL(client.contract.extraPhotoPrice)} / extra</p>
            {quote.hasExtraDiscount && (
              <p className="mt-1 text-xs text-amber-200/80">Quanto mais extras, maior o cupom</p>
            )}
          </div>
        </div>
      </section>

      {hasOwnedPhotos && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-xl" style={{ fontFamily: "var(--font-serif)" }}>
                Suas fotos
              </h3>
              <p className="text-sm text-muted-foreground">
                Essas você já escolheu. Toque para ampliar ou baixe em alta.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onDownloadAllOwned}>
              Baixar minhas fotos
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {owned.map((photo) => (
              <ClientPhotoCard
                key={photo.id}
                photo={photo}
                onOpen={() => openViewer(owned, photo)}
                onDownload={() => onDownload(photo)}
              />
            ))}
          </div>
        </section>
      )}

      {book.length > 0 && (
        <section className="space-y-4 pb-52">
          <div className="space-y-2">
            <h3 className="text-xl" style={{ fontFamily: "var(--font-serif)" }}>
              {hasOwnedPhotos ? "Ainda ficou alguma?" : "Escolha com o coração"}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Toque no <Heart className="mx-0.5 inline h-4 w-4 fill-rose-500 text-rose-500" /> nas que você quiser
              guardar. As {client.contract.contractedCount} do pacote já estão pagas. O que passar disso é extra — para
              você não deixar passar o que te emocionou.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {book.map((photo) => (
              <ClientPhotoCard
                key={photo.id}
                photo={photo}
                onOpen={() => openViewer(book, photo)}
                onFavorite={() => onToggleFavorite(photo.id)}
              />
            ))}
          </div>
        </section>
      )}

      {quote.selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/50 bg-background/95 px-4 py-4 backdrop-blur md:px-10">
          <div className="mx-auto flex max-w-[800px] flex-col gap-3">
            {(encouragement.stickyNote || showCoupon) && (
              <div className="flex items-start gap-3">
                {showCoupon && (
                  <CouponTicket
                    value={
                      quote.extrasUntilDiscount === 1 && quote.extraCount > 0
                        ? quote.nextCouponValue
                        : quote.couponValue > 0
                          ? quote.couponValue
                          : quote.nextCouponValue
                    }
                    shakeLevel={quote.couponShakeLevel}
                    unlocked={quote.justUnlockedCoupon}
                    almostYours={quote.extrasUntilDiscount === 1 && quote.extraCount > 0}
                    growing={quote.couponValue > 0 && !quote.justUnlockedCoupon}
                  />
                )}
                {encouragement.stickyNote && (
                  <p className={`min-w-0 flex-1 text-sm leading-relaxed ${toneClass}`}>
                    {encouragement.stickyNote}
                  </p>
                )}
              </div>
            )}

            {quote.hasExtraDiscount && quote.extraCount > 0 && (
              <div className="space-y-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      quote.couponShakeLevel >= 3 ? "bg-amber-300" : "bg-amber-300/80"
                    }`}
                    style={{ width: `${discountProgress}%` }}
                  />
                </div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {quote.justUnlockedCoupon
                    ? `Cupom de ${formatBRL(quote.couponValue)}`
                    : quote.couponValue > 0
                      ? `O cupom quer virar ${formatBRL(quote.nextCouponValue)}`
                      : "O cupom está chegando"}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-foreground">
                  {quote.selectedCount} {quote.selectedCount === 1 ? "foto escolhida" : "fotos escolhidas"}
                  {quote.extraCount > 0
                    ? ` · ${quote.extraCount} extra${quote.extraCount === 1 ? "" : "s"}`
                    : ""}
                </p>
                {quote.canSubmit && (
                  <div className="space-y-0.5">
                    <p className="text-sm text-muted-foreground">
                      <span className="line-through">{formatBRL(quote.alreadyPaid)}</span>
                      <span className="ml-2">já pago no contrato</span>
                    </p>
                    <p className="text-lg font-medium">
                      {quote.amountDue > 0 ? (
                        <>
                          A pagar agora:{" "}
                          {quote.appliesExtraDiscount && (
                            <span className="mr-2 text-base font-normal text-muted-foreground line-through">
                              {formatBRL(quote.extraSubtotal)}
                            </span>
                          )}
                          {formatBRL(quote.amountDue)}
                        </>
                      ) : (
                        <>Nada a pagar agora</>
                      )}
                    </p>
                  </div>
                )}
                {client.selectionSubmittedAt && quote.canSubmit && (
                  <p className="text-xs text-muted-foreground">
                    WhatsApp aberto. Quando a Mônica liberar, essas fotos aparecem em “Suas fotos”.
                  </p>
                )}
              </div>
              <Button onClick={onNotifyWhatsApp} disabled={!quote.canSubmit}>
                Já escolhi minhas fotos
              </Button>
            </div>
          </div>
        </div>
      )}

      {album && viewerPhotos && (
        <PhotoViewer album={album} onClose={() => setViewerPhotos(null)} initialPhotoIndex={viewerIndex} />
      )}
    </div>
  );
}
