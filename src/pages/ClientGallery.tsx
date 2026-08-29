import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import Header from "@/components/Header";
import { ClientPhotosExperience } from "@/components/ClientPhotosExperience";
import { useToast } from "@/hooks/use-toast";
import { useClientPackage } from "@/hooks/useClientPackages";
import { getClientPackage, getClientPhotoFileUrl, notifyClientSelection, toggleClientPhotoFavorite } from "@/lib/api";
import { applyPhotoFavorite, openSelectionWhatsApp, type ClientPackage, type ClientPhoto } from "@/lib/clientPackages";

function normalizeClientId(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "");
}

async function downloadFromUrl(url: string, filename: string) {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Falha ao baixar arquivo: ${res.status}`);
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename || "download";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}

const ClientGallery = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const lastAutoValidatedIdRef = useRef<string>("");

  const initialId = useMemo(() => {
    const fromUrl = searchParams.get("id");
    return typeof fromUrl === "string" ? fromUrl.trim() : "";
  }, [searchParams]);

  const [codeInput, setCodeInput] = useState(initialId);
  const [busy, setBusy] = useState(false);
  const [activeClientId, setActiveClientId] = useState<string>("");
  const [mustReadBestPractices, setMustReadBestPractices] = useState(false);
  const [bestPracticesProgress, setBestPracticesProgress] = useState(0);
  const [bestPracticesProgressDone, setBestPracticesProgressDone] = useState(false);
  const bestPracticesSectionRef = useRef<HTMLElement | null>(null);

  const { client, setClient } = useClientPackage(activeClientId);
  const clientRef = useRef<ClientPackage | undefined>(client);
  clientRef.current = client;
  const favoriteSyncRef = useRef({
    inFlight: new Set<string>(),
    desired: new Map<string, boolean>(),
    acked: new Map<string, boolean>(),
  });

  useEffect(() => {
    favoriteSyncRef.current = {
      inFlight: new Set(),
      desired: new Map(),
      acked: new Map(),
    };
  }, [activeClientId]);

  useEffect(() => {
    setCodeInput(initialId);
  }, [initialId]);

  const validateId = async (
    rawId: string,
    options?: { showSuccessToast?: boolean; autoScrollToBestPractices?: boolean }
  ) => {
    const normalized = normalizeClientId(rawId);
    if (!normalized) {
      toast({
        variant: "destructive",
        title: "Informe o código",
        description: "Digite o código que a Mônica te enviou para ver as fotos.",
      });
      return;
    }

    setBusy(true);
    try {
      const resolved = await getClientPackage(normalized);

      setActiveClientId(resolved.id);
      setSearchParams({ id: resolved.id });
      setMustReadBestPractices(true);
      setBestPracticesProgress(0);
      setBestPracticesProgressDone(false);

      if (options?.autoScrollToBestPractices !== false) {
        window.setTimeout(() => {
          bestPracticesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      }

      if (options?.showSuccessToast !== false) {
        toast({ title: "Fotos encontradas", description: `Olá, ${resolved.name.split(" ")[0]}.` });
      }
    } catch (error) {
      setActiveClientId("");
      toast({
        variant: "destructive",
        title: "Código inválido",
        description: error instanceof Error ? error.message : "Não foi possível abrir as fotos.",
      });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!mustReadBestPractices) return;
    if (bestPracticesProgressDone) return;

    const durationMs = 10_000;
    const stepMs = 100;
    const totalSteps = Math.ceil(durationMs / stepMs);
    let step = 0;

    const timer = window.setInterval(() => {
      step += 1;
      const next = Math.min(100, Math.round((step / totalSteps) * 100));
      setBestPracticesProgress(next);
      if (next >= 100) {
        window.clearInterval(timer);
        setBestPracticesProgressDone(true);
      }
    }, stepMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [bestPracticesProgressDone, mustReadBestPractices]);

  useEffect(() => {
    const normalized = normalizeClientId(initialId);
    if (!normalized) return;
    if (busy) return;
    if (lastAutoValidatedIdRef.current === normalized) return;

    lastAutoValidatedIdRef.current = normalized;
    void validateId(normalized, { showSuccessToast: false, autoScrollToBestPractices: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  const flushFavorite = useCallback(
    async (clientId: string, photoId: string) => {
      const sync = favoriteSyncRef.current;
      if (sync.inFlight.has(photoId)) return;
      sync.inFlight.add(photoId);

      try {
        while (sync.desired.has(photoId)) {
          const favorited = sync.desired.get(photoId)!;
          sync.desired.delete(photoId);
          try {
            const result = await toggleClientPhotoFavorite(clientId, photoId, favorited);
            sync.acked.set(photoId, result.favorited);
          } catch (error) {
            const revertTo = sync.acked.has(photoId) ? sync.acked.get(photoId)! : !favorited;
            const current = clientRef.current;
            if (current) {
              const reverted = applyPhotoFavorite(current, photoId, revertTo);
              clientRef.current = reverted;
              setClient(reverted);
            }
            toast({
              variant: "destructive",
              title: "Não foi possível guardar essa foto",
              description: error instanceof Error ? error.message : "Tente de novo.",
            });
            break;
          }
        }
      } finally {
        sync.inFlight.delete(photoId);
        if (sync.desired.has(photoId)) {
          void flushFavorite(clientId, photoId);
        }
      }
    },
    [setClient, toast]
  );

  const handleToggleFavorite = useCallback(
    (photoId: string) => {
      const current = clientRef.current;
      if (!current || !current.photoSelectionEnabled) return;
      const photo = current.photos.find((item) => item.id === photoId);
      if (!photo || photo.status === "released") return;

      const nextFavorited = !photo.favorited;
      const nextClient = applyPhotoFavorite(current, photoId, nextFavorited);
      clientRef.current = nextClient;
      setClient(nextClient);

      favoriteSyncRef.current.desired.set(photoId, nextFavorited);
      void flushFavorite(current.id, photoId);
    },
    [flushFavorite, setClient]
  );

  const handleDownload = async (photo: ClientPhoto) => {
    if (!client || photo.status !== "released") {
      toast({
        variant: "destructive",
        title: "Foto ainda não liberada",
        description: "A versão em alta só fica disponível depois que a Mônica liberar.",
      });
      return;
    }
    await downloadFromUrl(getClientPhotoFileUrl(client.id, photo.id), photo.name);
  };

  const handleDownloadAllOwned = async () => {
    if (!client) return;
    const owned = client.photos.filter((photo) => photo.status === "released");
    for (const photo of owned) {
      try {
        await downloadFromUrl(getClientPhotoFileUrl(client.id, photo.id), photo.name);
      } catch {
        // keep going so a single failure doesn't stop the rest
      }
    }
    toast({ title: "Download iniciado", description: "Salvamos as fotos do seu pacote." });
  };

  return (
    <main className="min-h-screen bg-background w-full lg:max-w-[800px] lg:mx-auto">
      <Header />

      <div className="px-6 md:px-10 pt-16 md:pt-20 pb-10 space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Área do cliente</p>
          <h1 className="text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
            Suas fotos
          </h1>
        </header>

        <section className="rounded-lg border border-border/60 bg-card p-5 space-y-3">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground" htmlFor="client-code">
              Seu código
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                id="client-code"
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
                placeholder="Cole aqui o código que você recebeu"
                autoComplete="one-time-code"
                disabled={busy}
              />
              <Button onClick={() => void validateId(codeInput, { showSuccessToast: false })} disabled={busy}>
                {busy ? "Abrindo..." : "Ver minhas fotos"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Para testar, use os códigos{" "}
              <button type="button" className="underline" onClick={() => setCodeInput("ana")}>
                ana
              </button>
              ,{" "}
              <button type="button" className="underline" onClick={() => setCodeInput("bruno")}>
                bruno
              </button>{" "}
              ou{" "}
              <button type="button" className="underline" onClick={() => setCodeInput("carla")}>
                carla
              </button>
              .
            </p>
          </div>
        </section>

        <section
          ref={bestPracticesSectionRef}
          className={
            mustReadBestPractices
              ? "rounded-lg border border-primary/30 bg-primary/5 p-5 space-y-4 ring-1 ring-primary/20"
              : "rounded-lg border border-border/60 bg-card p-5 space-y-3"
          }
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-primary/15 p-2 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2
                  className={
                    mustReadBestPractices
                      ? "text-xl font-bold tracking-normal leading-snug text-primary"
                      : "text-xl font-bold tracking-normal leading-snug text-foreground"
                  }
                >
                  Boas práticas para arrasar nas redes sociais
                </h2>
                {mustReadBestPractices && (
                  <p className="text-sm font-medium text-primary">Leia até o final para liberar as fotos.</p>
                )}
              </div>
            </div>
            {mustReadBestPractices && (
              <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground">
                Obrigatório
              </span>
            )}
          </div>

          <div className="space-y-3 text-base text-muted-foreground">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <span className="text-foreground">Quer postar com qualidade máxima?</span> Baixe a foto e poste o arquivo original.
              </li>
              <li>
                No WhatsApp, se puder, envie como <span className="text-foreground">Documento</span>. Se mandar como imagem, marque HD.
              </li>
              <li>
                <span className="text-foreground">No Instagram, fuja de print</span> e de ficar editando mil vezes.
              </li>
              <li>
                <span className="text-foreground">Guardaremos suas fotos por até 3 meses.</span> Depois, a responsabilidade de manter os arquivos é sua.
              </li>
            </ul>

            {mustReadBestPractices && !bestPracticesProgressDone && (
              <div className="space-y-2 pt-2">
                <Progress value={bestPracticesProgress} />
                <p className="text-sm text-muted-foreground">Este tempo é só para você ler o recado acima.</p>
              </div>
            )}

            {mustReadBestPractices && bestPracticesProgressDone && (
              <div className="pt-2">
                <Button type="button" onClick={() => setMustReadBestPractices(false)} className="w-full">
                  Já li, quero ver as fotos
                </Button>
              </div>
            )}
          </div>
        </section>

        {!mustReadBestPractices && client && (
          <ClientPhotosExperience
            client={client}
            onToggleFavorite={handleToggleFavorite}
            onNotifyWhatsApp={() => {
              void (async () => {
                const opened = openSelectionWhatsApp(client);
                if (!opened) {
                  toast({
                    variant: "destructive",
                    title: "Escolha as fotos",
                    description: "Toque no coração nas fotos que você quer antes de avisar no WhatsApp.",
                  });
                  return;
                }
                try {
                  const next = await notifyClientSelection(client.id);
                  setClient(next);
                } catch {
                  // WhatsApp já abriu; o aviso no servidor pode ser tentado de novo depois
                }
                toast({
                  title: "WhatsApp aberto",
                  description: "Mande a mensagem para a Mônica. Depois ela libera as fotos neste mesmo link.",
                });
              })();
            }}
            onDownload={(photo) => {
              void handleDownload(photo);
            }}
            onDownloadAllOwned={() => {
              void handleDownloadAllOwned();
            }}
          />
        )}

        {!mustReadBestPractices && !client && (
          <p className="text-sm text-muted-foreground">{busy ? "Abrindo suas fotos..." : "Informe seu código para ver as fotos."}</p>
        )}

        {!mustReadBestPractices && client && (
          <div className="pt-2">
            <Button asChild className="w-full" variant="outline">
              <Link to="/">Conheça mais sobre nosso trabalho</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
};

export default ClientGallery;
