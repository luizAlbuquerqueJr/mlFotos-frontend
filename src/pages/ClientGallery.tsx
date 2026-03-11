import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import Header from "@/components/Header";
import PhotoViewer from "@/components/PhotoViewer";
import { useToast } from "@/hooks/use-toast";
import {
  getUserById,
  listManagerPath,
  type ManagerFileItem,
  type ManagerFolderItem,
  type UserRecord,
} from "@/lib/api";

function buildAlbumFromFiles(user: UserRecord, files: ManagerFileItem[]) {
  return {
    id: user.id,
    title: `Fotos de ${user.name}`,
    cover: files[0]?.url ?? "",
    photos: files.map((f) => ({ src: f.url, alt: f.name })),
  };
}

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
  const [user, setUser] = useState<UserRecord | null>(null);
  const [currentFolderPath, setCurrentFolderPath] = useState<string>("");
  const [folders, setFolders] = useState<ManagerFolderItem[]>([]);
  const [files, setFiles] = useState<ManagerFileItem[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadAllProgress, setDownloadAllProgress] = useState(0);
  const [mustReadBestPractices, setMustReadBestPractices] = useState(false);
  const [bestPracticesProgress, setBestPracticesProgress] = useState(0);
  const [bestPracticesProgressDone, setBestPracticesProgressDone] = useState(false);

  const bestPracticesSectionRef = useRef<HTMLElement | null>(null);

  const rootClientFolderPath = useMemo(() => {
    return user ? `clientes/${user.id}` : "";
  }, [user]);

  const breadcrumbs = useMemo(() => {
    if (!rootClientFolderPath || !currentFolderPath) return [] as string[];
    if (currentFolderPath === rootClientFolderPath) return [] as string[];
    if (!currentFolderPath.startsWith(rootClientFolderPath + "/")) return [] as string[];

    const rel = currentFolderPath.slice(rootClientFolderPath.length + 1);
    return rel.split("/").filter(Boolean);
  }, [currentFolderPath, rootClientFolderPath]);

  const loadListing = async (folderPath: string, bucket: "clientes") => {
    const listing = await listManagerPath(folderPath, bucket);
    setFolders(listing.folders);
    setFiles(listing.files);
  };

  const listAllClientFilesRecursive = async (clientRootPath: string) => {
    const all: ManagerFileItem[] = [];
    const queue: string[] = [clientRootPath];

    while (queue.length > 0) {
      const nextPath = queue.shift();
      if (!nextPath) continue;
      const listing = await listManagerPath(nextPath, "clientes");

      for (const folder of listing.folders) {
        if (folder?.path) queue.push(folder.path);
      }

      for (const file of listing.files) {
        if (file.name === ".keep") continue;
        all.push(file);
      }
    }

    return all;
  };

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
        title: "Informe o id",
        description: "Digite o id do cliente para acessar as fotos.",
      });
      return;
    }

    // if (!/^[A-HJ-NP-Z2-9]{20}$/.test(normalized)) {
    //   toast({
    //     variant: "destructive",
    //     title: "Código inválido",
    //     description: "O código deve ter 20 caracteres. Verifique e tente novamente.",
    //   });
    //   return;
    // }

    setBusy(true);
    try {
      const resolvedUser = await getUserById(normalized);
      setUser(resolvedUser);
      setSearchParams({ id: resolvedUser.id });

      const folderPath = `clientes/${resolvedUser.id}`;
      setCurrentFolderPath(folderPath);
      await loadListing(folderPath, "clientes");

      setMustReadBestPractices(true);
      setBestPracticesProgress(0);
      setBestPracticesProgressDone(false);

      if (options?.autoScrollToBestPractices !== false) {
        window.setTimeout(() => {
          bestPracticesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      }

      if (options?.showSuccessToast !== false) {
        toast({ title: "ID validado" });
      }
    } catch (error) {
      setUser(null);
      setCurrentFolderPath("");
      setFolders([]);
      setFiles([]);

      toast({
        variant: "destructive",
        title: "ID inválido",
        description: error instanceof Error ? error.message : "Não foi possível validar o id.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleValidate = async () => {
    await validateId(codeInput, { showSuccessToast: false, autoScrollToBestPractices: true });
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

  const album = useMemo(() => {
    if (!user) return null;
    if (files.length === 0) return null;
    return buildAlbumFromFiles(user, files);
  }, [files, user]);

  const handleOpenFolder = async (folder: ManagerFolderItem) => {
    if (!user) return;
    if (!folder?.path) return;

    setBusy(true);
    try {
      setCurrentFolderPath(folder.path);
      await loadListing(folder.path, "clientes");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao abrir pasta",
        description: error instanceof Error ? error.message : "Falha ao carregar pasta.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleGoToPath = async (path: string) => {
    if (!user) return;
    if (!path) return;

    setBusy(true);
    try {
      setCurrentFolderPath(path);
      await loadListing(path, "clientes");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar",
        description: error instanceof Error ? error.message : "Falha ao carregar pasta.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadOne = async (file: ManagerFileItem) => {
    await downloadFromUrl(file.url, file.name);
  };

  const handleDownloadAll = async () => {
    if (!user) return;
    setDownloadingAll(true);
    setDownloadAllProgress(0);
    try {
      const rootPath = `clientes/${user.id}`;
      const allFiles = await listAllClientFilesRecursive(rootPath);
      const total = allFiles.length;
      if (total === 0) {
        toast({
          variant: "destructive",
          title: "Nada para baixar",
          description: "Nenhuma foto disponível no momento.",
        });
        return;
      }

      let failures = 0;

      for (let i = 0; i < allFiles.length; i += 1) {
        const file = allFiles[i];
        try {
          await downloadFromUrl(file.url, file.name);
        } catch {
          failures += 1;
        }

        const pct = Math.min(100, Math.round(((i + 1) / total) * 100));
        setDownloadAllProgress(pct);
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      setDownloadAllProgress(100);
      toast({
        title: "Fotos baixadas",
        description: failures > 0 ? `${failures} arquivo(s) não puderam ser baixados.` : undefined,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao baixar",
        description: error instanceof Error ? error.message : "Falha ao baixar as fotos.",
      });
    } finally {
      setDownloadingAll(false);
    }
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
              ID do cliente
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                id="client-code"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Ex: A1B2C3D4E5F6"
                autoComplete="one-time-code"
                disabled={busy}
              />
              <Button onClick={() => void handleValidate()} disabled={busy}>
                {busy ? "Validando..." : "Acessar"}
              </Button>
            </div>

            {user && (
              <p className="text-sm text-muted-foreground">
                Olá, <span className="text-foreground">{user.name}</span>.
              </p>
            )}
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
                <h2 className={
                  mustReadBestPractices
                    ? "text-xl font-bold tracking-normal leading-snug text-primary"
                    : "text-xl font-bold tracking-normal leading-snug text-foreground"
                }>
                  Boas práticas para arrasar nas redes sociais
                </h2>
                {mustReadBestPractices && (
                  <p className="text-sm font-medium text-primary">
                    Leia até o final para liberar as fotos.
                  </p>
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
                <span className="text-foreground">Quer postar com qualidade máxima? ✨</span> Baixe a foto e poste o arquivo original (evite "reenviar" várias vezes a mesma
                imagem, porque isso prejudica a qualidade).
              </li>
              <li>
                No WhatsApp, se puder, envie como <span className="text-foreground">Documento</span> 📄 (assim não comprime). Se
                mandar como imagem, marque a opção de HD 😎.
              </li>
              <li>
                <span className="text-foreground">No Instagram, fuja de print/screenshot 📸 e de ficar editando mil vezes</span>. Poste direto do arquivo e, se for recortar,
                recorte só uma vez.
              </li>
              <li>
                <span className="text-foreground"> Evite montar grid (tipo 4 fotos em 1) </span>. Isso diminui a resolução e pode
                deixar a imagem com cara de baixa qualidade.
              </li>
              <li>
                Na hora de baixar, garanta uma internet estável para não travar no meio. <span className="text-foreground">Evite dados móveis</span>, as
                fotos são pesadinhas e podem consumir seu pacote rapidinho 😅.
              </li>
              <li>
                <span className="text-foreground">Guardaremos suas fotos por até 3 meses.</span> Após esse período, a responsabilidade de manter os arquivos salvos será sua, combinado? 🤗
              </li>
            </ul>

            {mustReadBestPractices && !bestPracticesProgressDone && (
              <div className="space-y-2 pt-2">
                <Progress value={bestPracticesProgress} />
                <p className="text-sm text-muted-foreground">
                  Carregando... este tempo é apenas para você ler a mensagem acima.
                </p>
              </div>
            )}

            {mustReadBestPractices && bestPracticesProgressDone && (
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={() => setMustReadBestPractices(false)}
                  className="w-full"
                >
                  Já li as boas práticas, quero ver as fotos.
                </Button>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border/60 bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Fotos</h2>

          {mustReadBestPractices && (
            <p className="text-sm text-muted-foreground">
              Aguarde um instante e leia as boas práticas acima.
            </p>
          )}

          {!mustReadBestPractices && user && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void handleGoToPath(rootClientFolderPath)}
                  >
                    Raiz
                  </Button>

                  {breadcrumbs.map((segment, index) => {
                    const path = [rootClientFolderPath, ...breadcrumbs.slice(0, index + 1)].filter(Boolean).join("/");
                    return (
                      <Button
                        key={path}
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void handleGoToPath(path)}
                      >
                        {segment}
                      </Button>
                    );
                  })}

                  {currentFolderPath && (
                    <span className="text-muted-foreground">/ {currentFolderPath}</span>
                  )}
                </div>

                <Button className="w-full" variant="outline" size="sm" onClick={() => void handleDownloadAll()} disabled={downloadingAll}>
                  {downloadingAll ? "Baixando..." : "Baixar todas as imagens"}
                </Button>
              </div>

              {downloadingAll && (
                <div className="space-y-2">
                  <Progress value={downloadAllProgress} />
                  <p className="text-sm text-muted-foreground">{downloadAllProgress}% concluído</p>
                </div>
              )}
            </div>
          )}

          {!mustReadBestPractices && !user && (
            <p className="text-sm text-muted-foreground">{busy ? "Carregando fotos..." : "Informe seu id para visualizar as fotos."}</p>
          )}

          {!mustReadBestPractices && user && folders.length === 0 && files.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma foto disponível no momento.</p>
          )}

          {!mustReadBestPractices && user && folders.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Pastas</p>
              <ul className="space-y-2">
                {folders.map((folder) => (
                  <li key={folder.path}>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start"
                      disabled={busy}
                      onClick={() => void handleOpenFolder(folder)}
                    >
                      📁 {folder.name}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!mustReadBestPractices && user && files.length > 0 && (
            <div className="flex justify-end">
              <span />
            </div>
          )}

          {!mustReadBestPractices && user && files.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {files.map((file, index) => (
                <div
                  key={file.path}
                  className="group relative overflow-hidden rounded border border-border/40 bg-muted/10"
                >
                  <button
                    type="button"
                    className="absolute right-2 top-2 z-10 rounded-md bg-black/60 p-2 text-white backdrop-blur-sm hover:bg-black/70"
                    aria-label="Baixar foto"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleDownloadOne(file);
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    className="block w-full"
                    onClick={() => {
                      setViewerIndex(index);
                      setViewerOpen(true);
                    }}
                  >
                  <img
                    src={file.url}
                    alt={file.name}
                    loading="lazy"
                    className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {!mustReadBestPractices && user && files.length > 0 && (
          <div className="pt-2">
            <Button asChild className="w-full">
              <Link to="/">Conheça mais sobre nosso trabalho</Link>
            </Button>
          </div>
        )}
      </div>

      {viewerOpen && album && (
        <PhotoViewer
          album={album}
          onClose={() => setViewerOpen(false)}
          initialPhotoIndex={viewerIndex}
        />
      )}
    </main>
  );
};

export default ClientGallery;
