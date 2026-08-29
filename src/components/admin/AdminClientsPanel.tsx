import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { ArrowLeft, Check, FileUp, Heart, Plus, Search, Trash2, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import PhotoViewer from "@/components/PhotoViewer";
import { WatermarkedPhoto } from "@/components/WatermarkedPhoto";
import { useToast } from "@/hooks/use-toast";
import {
  createClientOnApi,
  deleteClientOnApi,
  releasePhotosOnApi,
  renameClientOnApi,
  updateClientContractOnApi,
  useClientPackages,
} from "@/hooks/useClientPackages";
import { getAdminUploadTokenIfAuthenticated } from "@/lib/firebaseAuth";
import { getClientPackage, uploadImageToPath } from "@/lib/api";
import {
  canSelectPhotos,
  countPendingFavorites,
  countReleasedPhotos,
  DEFAULT_CONTRACT,
  formatBRL,
  quoteSelection,
  type ClientContract,
  type ClientPackage,
} from "@/lib/clientPackages";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
    <path d="M16 3C8.84 3 3 8.676 3 15.67c0 2.791.94 5.36 2.522 7.446L4 29l5.99-1.497A13.267 13.267 0 0 0 16 28.34c7.16 0 13-5.676 13-12.67C29 8.676 23.16 3 16 3Zm0 23.004c-2.03 0-4.01-.53-5.728-1.53l-.412-.242-3.55.887.95-3.37-.269-.42A10.88 10.88 0 0 1 5.12 15.67C5.12 9.85 10.024 5.1 16 5.1c5.976 0 10.88 4.75 10.88 10.57 0 5.82-4.904 10.334-10.88 10.334Zm6.117-7.743c-.334-.166-1.97-.957-2.274-1.066-.305-.11-.527-.166-.75.166-.222.333-.86 1.066-1.055 1.285-.195.222-.389.25-.723.083-.334-.166-1.41-.512-2.685-1.632-.992-.86-1.662-1.922-1.857-2.255-.195-.333-.02-.513.146-.679.151-.151.334-.389.5-.583.166-.195.222-.333.334-.555.11-.222.055-.417-.028-.583-.083-.166-.75-1.785-1.028-2.447-.27-.646-.545-.558-.75-.568l-.64-.013a1.23 1.23 0 0 0-.89.416c-.305.333-1.166 1.121-1.166 2.73 0 1.609 1.194 3.163 1.36 3.385.166.222 2.35 3.58 5.688 5.02.794.334 1.414.533 1.897.683.797.244 1.524.21 2.098.128.64-.096 1.97-.791 2.247-1.555.278-.763.278-1.414.195-1.555-.083-.138-.305-.222-.64-.389Z" />
  </svg>
);

function shareClientWhatsapp(client: ClientPackage) {
  const url = `${window.location.origin}/clientes?id=${encodeURIComponent(client.id)}`;
  const firstName = client.name.split(" ")[0];
  const text = canSelectPhotos(client)
    ? `Olá, ${firstName}!
Aqui está o link do seu book: ${url}
Toque no coração nas fotos que quiser. O contrato inclui ${client.contract.contractedCount} fotos.`
    : `Olá, ${firstName}!
Aqui está o link do seu book: ${url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

function ClientStatusBadge({ client }: { client: ClientPackage }) {
  if (!canSelectPhotos(client)) return null;
  const pending = countPendingFavorites(client);
  const owned = countReleasedPhotos(client);
  if (client.selectionSubmittedAt && pending > 0) {
    return <Badge className="bg-amber-500/20 text-amber-200 hover:bg-amber-500/20">Aguardando liberar {pending}</Badge>;
  }
  if (pending > 0) {
    return (
      <Badge variant="secondary">
        O cliente escolheu {pending} {pending === 1 ? "foto" : "fotos"}
      </Badge>
    );
  }
  if (owned > 0) {
    return <Badge variant="outline">{owned} liberadas</Badge>;
  }
  return <Badge variant="outline">Aguardando escolha</Badge>;
}

function ClientCard({
  client,
  onOpen,
  onDelete,
}: {
  client: ClientPackage;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const quote = quoteSelection(client);
  const pointer = useRef({ x: 0, y: 0, moved: false });

  const handleCardPointerDown = (event: PointerEvent<HTMLElement>) => {
    pointer.current = { x: event.clientX, y: event.clientY, moved: false };
  };

  const handleCardPointerMove = (event: PointerEvent<HTMLElement>) => {
    const dx = event.clientX - pointer.current.x;
    const dy = event.clientY - pointer.current.y;
    if (dx * dx + dy * dy > 64) pointer.current.moved = true;
  };

  const handleCardClick = () => {
    if (pointer.current.moved) return;
    onOpen();
  };

  return (
    <article
      className="cursor-pointer select-none rounded-2xl border border-border/50 bg-card p-4 space-y-4"
      onPointerDown={handleCardPointerDown}
      onPointerMove={handleCardPointerMove}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3 text-left">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background">
            <UserRound className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base text-foreground">{client.name}</span>
            <span className="block text-xs text-muted-foreground">{client.id}</span>
          </span>
        </div>
        <ClientStatusBadge client={client} />
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-background/50 p-2.5">
          <dt className="text-muted-foreground">Contrato</dt>
          <dd className="mt-0.5 text-foreground">
            {canSelectPhotos(client)
              ? `${client.contract.contractedCount} fotos · ${formatBRL(client.contract.contractedPrice)}`
              : "não definida"}
          </dd>
        </div>
        <div className="rounded-lg bg-background/50 p-2.5">
          <dt className="text-muted-foreground">Foto extra</dt>
          <dd className="mt-0.5 text-foreground">
            {canSelectPhotos(client) ? formatBRL(client.contract.extraPhotoPrice) : "não definida"}
          </dd>
        </div>
        <div className="col-span-2 rounded-lg bg-background/50 p-2.5">
          <dt className="text-muted-foreground">Pedido atual</dt>
          <dd className="mt-0.5 text-foreground">
            {!canSelectPhotos(client)
              ? "não definida"
              : quote.selectedCount === 0
                ? "Nenhuma foto escolhida"
                : `${quote.extraCount} extras · a pagar ${formatBRL(quote.amountDue)}`}
          </dd>
        </div>
      </dl>

      <div
        className="flex items-center justify-between gap-2"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => shareClientWhatsapp(client)}
        >
          <WhatsAppIcon className="h-4 w-4" />
          Enviar link
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete} aria-label="Apagar">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </article>
  );
}

function emptyDraft(): ClientPackage {
  return {
    id: "",
    name: "",
    contract: { ...DEFAULT_CONTRACT },
    photos: [],
    photoSelectionEnabled: true,
  };
}

function ClientDetail({
  clientId,
  authToken,
  onBack,
  onClientChange,
  onCreated,
}: {
  clientId: string | null;
  authToken: string;
  onBack: () => void;
  onClientChange: (client: ClientPackage) => void;
  onCreated: (client: ClientPackage) => void;
}) {
  const { toast } = useToast();
  const isNew = !clientId;
  const [client, setClient] = useState<ClientPackage | null>(isNew ? emptyDraft() : null);
  const [name, setName] = useState("");
  const [contract, setContract] = useState<ClientContract>({ ...DEFAULT_CONTRACT });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isNew) {
      const frame = requestAnimationFrame(() => nameInputRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }

    let cancelled = false;
    getClientPackage(clientId, authToken)
      .then((next) => {
        if (cancelled) return;
        setClient(next);
        setName(next.name);
        setContract(next.contract);
      })
      .catch((error) => {
        toast({
          variant: "destructive",
          title: "Não foi possível abrir o cliente",
          description: error instanceof Error ? error.message : "Tente de novo.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [authToken, clientId, isNew, toast]);

  if (!client) {
    return <p className="text-sm text-muted-foreground">Carregando cliente...</p>;
  }

  const quote = quoteSelection(client);

  const saveContract = async (field: keyof ClientContract, raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const value =
      field === "contractedCount" || field === "extraDiscountEvery" ? Math.round(parsed) : parsed;
    if (field === "extraDiscountEvery" && value < 1) return;

    setContract((current) => ({ ...current, [field]: value }));
    if (isNew) return;

    try {
      const next = await updateClientContractOnApi(client.id, { [field]: value }, authToken);
      setClient(next);
      setContract(next.contract);
      onClientChange(next);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Não foi possível salvar o contrato",
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    }
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || isNew || trimmed === client.name) return;
    try {
      const next = await renameClientOnApi(client.id, trimmed, authToken);
      setClient(next);
      setName(next.name);
      onClientChange(next);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Não foi possível salvar o nome",
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    }
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "Nome obrigatório",
        description: "Preencha o nome do cliente para salvar.",
      });
      nameInputRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      const created = await createClientOnApi(trimmed, authToken, contract);
      toast({
        title: "Cliente criado",
        description: "Agora você pode enviar as fotos do book.",
      });
      onCreated(created);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Não foi possível criar",
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setSaving(false);
    }
  };

  const reloadClient = async () => {
    const next = await getClientPackage(client.id, authToken);
    setClient(next);
    onClientChange(next);
  };

  const handleUploadFiles = async (pickedFiles: File[]) => {
    if (isNew) {
      toast({
        title: "Salve o cliente primeiro",
        description: "Preencha o nome e toque em Salvar cliente para enviar fotos.",
      });
      return;
    }
    const images = pickedFiles.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhuma imagem",
        description: "Escolha arquivos JPG, PNG ou WEBP.",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadingCount(images.length);

    let completed = 0;
    let failures = 0;
    const folderPath = `clientes/${client.id}`;

    const uploadFile = async (file: File) => {
      try {
        await uploadImageToPath(folderPath, file, "clientes", authToken);
      } catch {
        failures += 1;
      } finally {
        completed += 1;
        setUploadProgress(Math.min(100, Math.round((completed / images.length) * 100)));
      }
    };

    try {
      const concurrency = 3;
      for (let index = 0; index < images.length; index += concurrency) {
        await Promise.allSettled(images.slice(index, index + concurrency).map(uploadFile));
      }
      await reloadClient();
      toast({
        title: failures === 0 ? "Fotos enviadas" : "Upload concluído com falhas",
        description:
          failures === 0
            ? "O cliente já vê a prévia com marca d'água. A original só sai depois de você liberar."
            : `${failures} arquivo(s) falharam.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Não foi possível enviar",
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setUploading(false);
      setUploadingCount(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRelease = async () => {
    try {
      const next = await releasePhotosOnApi(client.id, authToken);
      setClient(next);
      onClientChange(next);
      toast({
        title: "Fotos liberadas",
        description: "No mesmo link, o cliente já vê essas fotos em “Suas fotos”, sem marca d'água.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Não foi possível liberar",
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    }
  };

  const uploadButton = (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={uploading || isNew}
        onClick={() => {
          if (isNew) {
            toast({
              title: "Salve o cliente primeiro",
              description: "Preencha o nome e toque em Salvar cliente para enviar fotos.",
            });
            return;
          }
          fileInputRef.current?.click();
        }}
      >
        <FileUp className="h-4 w-4" />
        {uploading ? "Enviando..." : "Enviar fotos em alta"}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) void handleUploadFiles(files);
        }}
      />
    </>
  );

  return (
    <div className="space-y-6" key={isNew ? "new" : client.id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 px-0">
          <ArrowLeft className="h-4 w-4" />
          Todos os clientes
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {isNew ? (
            <Button type="button" size="sm" className="gap-2" disabled={saving} onClick={() => void handleCreate()}>
              <Check className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar cliente"}
            </Button>
          ) : (
            <>
              {uploadButton}
              <Button asChild variant="outline" size="sm">
                <Link to={`/clientes?id=${encodeURIComponent(client.id)}`}>Ver como o cliente</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {isNew ? "Novo cliente" : "Cliente"}
        </h3>
        <div className="space-y-2">
          <Label htmlFor="client-name">Nome</Label>
          <Input
            ref={nameInputRef}
            id="client-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => void saveName()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (isNew) void handleCreate();
                else void saveName();
              }
            }}
            placeholder="Ex.: Ana Silva"
            autoComplete="off"
          />
        </div>
        {isNew ? (
          <p className="text-sm text-muted-foreground">
            Preencha o nome, ajuste o contrato se quiser e salve. Depois você envia as fotos em alta.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Book com {client.photos.length} fotos · {client.id}
          </p>
        )}
        {(isNew || canSelectPhotos(client)) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contracted-count">Fotos do contrato</Label>
            <Input
              id="contracted-count"
              type="number"
              min={0}
              value={contract.contractedCount}
              onChange={(event) =>
                setContract((current) => ({ ...current, contractedCount: Number(event.target.value) || 0 }))
              }
              onBlur={(event) => void saveContract("contractedCount", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contracted-price">Valor do contrato (R$)</Label>
            <Input
              id="contracted-price"
              type="number"
              min={0}
              step="0.01"
              value={contract.contractedPrice}
              onChange={(event) =>
                setContract((current) => ({ ...current, contractedPrice: Number(event.target.value) || 0 }))
              }
              onBlur={(event) => void saveContract("contractedPrice", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="extra-price">Preço por foto extra (R$)</Label>
            <Input
              id="extra-price"
              type="number"
              min={0}
              step="0.01"
              value={contract.extraPhotoPrice}
              onChange={(event) =>
                setContract((current) => ({ ...current, extraPhotoPrice: Number(event.target.value) || 0 }))
              }
              onBlur={(event) => void saveContract("extraPhotoPrice", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="discount-every">O cupom cresce a cada quantas extras</Label>
            <Input
              id="discount-every"
              type="number"
              min={1}
              value={contract.extraDiscountEvery}
              onChange={(event) =>
                setContract((current) => ({ ...current, extraDiscountEvery: Number(event.target.value) || 1 }))
              }
              onBlur={(event) => void saveContract("extraDiscountEvery", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="discount-value">Quanto o cupom cresce (R$)</Label>
            <Input
              id="discount-value"
              type="number"
              min={0}
              step="0.01"
              value={contract.extraDiscountValue}
              onChange={(event) =>
                setContract((current) => ({ ...current, extraDiscountValue: Number(event.target.value) || 0 }))
              }
              onBlur={(event) => void saveContract("extraDiscountValue", event.target.value)}
            />
          </div>
        </div>
        )}
      </section>

      {!isNew && canSelectPhotos(client) && (
        <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Escolha do cliente</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {quote.selectedCount === 0
                  ? "O cliente ainda não escolheu fotos."
                  : `${quote.selectedCount} escolhidas · ${quote.extraCount} extras · a pagar ${formatBRL(quote.amountDue)}`}
              </p>
              {client.selectionSubmittedAt && quote.selectedCount > 0 && (
                <p className="mt-1 text-xs text-amber-200">O cliente já avisou no WhatsApp. Libere quando o combinado estiver ok.</p>
              )}
            </div>
            <Button onClick={() => void handleRelease()} disabled={quote.selectedCount === 0} className="gap-2">
              <Heart className="h-4 w-4" />
              Liberar fotos escolhidas
            </Button>
          </div>
        </section>
      )}

      {!isNew && (
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Fotos do book</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {canSelectPhotos(client)
              ? "Envie as originais em alta. O site gera sozinho a prévia com o grid de marca d'água. A original só sai depois que você liberar."
              : "Envie as originais em alta. O site gera sozinho a prévia com o grid de marca d'água."}
          </p>
        </div>

        {uploading && (
          <div className="space-y-2 rounded-xl border border-border/50 bg-card px-4 py-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Enviando {uploadingCount} {uploadingCount === 1 ? "foto" : "fotos"}...
              </span>
              <span className="font-medium">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {client.photos.length === 0 && !uploading ? (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 bg-card/60 px-4 py-10 text-center transition-colors hover:border-border hover:bg-card disabled:opacity-60"
          >
            <FileUp className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-foreground">Clique para enviar as fotos em alta</span>
            <span className="text-xs text-muted-foreground">JPG, PNG ou WEBP · várias de uma vez</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {client.photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                className="overflow-hidden rounded-xl border border-border/40 text-left transition-opacity hover:opacity-90"
                onClick={() => setViewerIndex(index)}
              >
                <WatermarkedPhoto src={photo.previewUrl} alt={photo.name} watermarked={photo.status !== "released"} />
                {canSelectPhotos(client) && (
                <div className="flex items-center justify-between gap-2 px-2 py-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <span>
                    {photo.status === "released" && "Liberada"}
                    {photo.status === "selectable" && photo.favorited && "Escolhida"}
                    {photo.status === "selectable" && !photo.favorited && "Book"}
                  </span>
                  {photo.favorited && photo.status === "selectable" && (
                    <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
                  )}
                </div>
                )}
              </button>
            ))}
          </div>
        )}
      </section>
      )}

      {viewerIndex !== null && (
        <PhotoViewer
          album={{
            id: client.id,
            title: `Fotos de ${client.name}`,
            cover: client.photos[viewerIndex]?.previewUrl ?? "",
            photos: client.photos.map((photo) => ({
              src: photo.previewUrl,
              originalSrc: "",
              alt: photo.name,
            })),
          }}
          initialPhotoIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}

const AdminClientsPanel = () => {
  const { toast } = useToast();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const { clients, loading, reload, setClients } = useClientPackages(authToken);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getAdminUploadTokenIfAuthenticated().then((token) => setAuthToken(token));
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) => client.name.toLowerCase().includes(term) || client.id.toLowerCase().includes(term));
  }, [clients, query]);

  const handleCreate = () => {
    if (!authToken) return;
    setSelectedId(null);
    setCreating(true);
  };

  const handleDelete = async (client: ClientPackage) => {
    if (!authToken) return;
    const ok = window.confirm(`Apagar o cliente "${client.name}" e as fotos dele no Storage?`);
    if (!ok) return;
    try {
      await deleteClientOnApi(client.id, authToken);
      setClients((current) => current.filter((item) => item.id !== client.id));
      if (selectedId === client.id) setSelectedId(null);
      setCreating(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Não foi possível apagar",
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    }
  };

  if ((creating || selectedId) && authToken) {
    return (
      <ClientDetail
        key={creating ? "new" : selectedId}
        clientId={creating ? null : selectedId}
        authToken={authToken}
        onBack={() => {
          setSelectedId(null);
          setCreating(false);
          void reload();
        }}
        onCreated={(next) => {
          setCreating(false);
          setSelectedId(next.id);
          setClients((current) => {
            const exists = current.some((item) => item.id === next.id);
            return exists ? current.map((item) => (item.id === next.id ? next : item)) : [...current, next];
          });
        }}
        onClientChange={(next) => {
          setClients((current) => current.map((item) => (item.id === next.id ? next : item)));
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-dashed border-border/70 bg-card/60 px-4 py-3 text-sm text-muted-foreground">
        Os clientes e as fotos vêm do Firebase e do Storage. Clientes novos escolhem no coração, avisam no WhatsApp, e
        você libera as fotos no mesmo link. Clientes já cadastrados só visualizam o book. Para testar: códigos{" "}
        <span className="text-foreground">ana</span>, <span className="text-foreground">bruno</span> e{" "}
        <span className="text-foreground">carla</span>.
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar cliente pelo nome ou código"
            className="pl-9"
          />
        </div>
        <Button onClick={() => void handleCreate()} className="gap-2" disabled={!authToken}>
          <Plus className="h-4 w-4" />
          Novo cliente
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando clientes...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onOpen={() => setSelectedId(client.id)}
              onDelete={() => void handleDelete(client)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminClientsPanel;
