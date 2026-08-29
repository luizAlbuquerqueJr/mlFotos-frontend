import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, FileUp, FolderPlus, Loader2, LogOut, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import ImageCropDialog from "@/components/ImageCropDialog";
import AdminClientsPanel from "@/components/admin/AdminClientsPanel";
import { useToast } from "@/hooks/use-toast";
import {
  AdminAuthError,
  ensureAdminUploadToken,
  getAdminUploadTokenIfAuthenticated,
  logoutAdmin,
} from "@/lib/firebaseAuth";
import { cropImageFile, type CropAreaPixels } from "@/lib/imageCrop";
import {
  buildManifest,
  createFolder,
  deleteFile,
  deleteFolder,
  listManagerPath,
  renameFile,
  renameFolder,
  getBucketSizes,
  type StorageBucketKey,
  type ManagerFileItem,
  type ManagerFolderItem,
  type BucketSizes,
  uploadImageToPath,
} from "@/lib/api";

const Admin = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [authChecking, setAuthChecking] = useState(true);
  const [adminAuthorized, setAdminAuthorized] = useState(false);
  const [currentPath, setCurrentPath] = useState("");
  const [bucket, setBucket] = useState<StorageBucketKey>("site");
  const [folders, setFolders] = useState<ManagerFolderItem[]>([]);
  const [files, setFiles] = useState<ManagerFileItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [bucketSizes, setBucketSizes] = useState<BucketSizes | null>(null);

  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropTitle, setCropTitle] = useState<string>("");
  const [cropAspect, setCropAspect] = useState<number>(9 / 16);

  const cropFileRef = useRef<File | null>(null);
  const cropObjectUrlRef = useRef<string | null>(null);
  const cropResolveRef = useRef<((file: File) => void) | null>(null);
  const cropRejectRef = useRef<((reason?: unknown) => void) | null>(null);

  const denyAccessAndGoHome = useCallback(
    (description?: string) => {
      toast({
        variant: "destructive",
        title: "Você não está autenticado",
        description: description ?? "Não foi possível acessar a área administrativa.",
        duration: 8000,
      });
      setAdminAuthorized(false);
      navigate("/", { replace: true });
    },
    [navigate, toast]
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const token = await getAdminUploadTokenIfAuthenticated();
        if (cancelled) return;
        setAdminAuthorized(Boolean(token));
      } catch {
        if (cancelled) return;
        denyAccessAndGoHome();
      } finally {
        if (!cancelled) {
          setAuthChecking(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [denyAccessAndGoHome]);

  const getAuthToken = useCallback(async (): Promise<string> => {
    try {
      return await ensureAdminUploadToken();
    } catch {
      denyAccessAndGoHome();
      throw new AdminAuthError();
    }
  }, [denyAccessAndGoHome]);

  const handleAdminLogin = async () => {
    try {
      setAuthChecking(true);
      await ensureAdminUploadToken();
      setAdminAuthorized(true);
    } catch {
      denyAccessAndGoHome();
    } finally {
      setAuthChecking(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutAdmin();
      setAdminAuthorized(false);
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
    } catch (error) {
      if (error instanceof AdminAuthError) return;
      toast({
        variant: "destructive",
        title: "Erro ao fazer logout",
        description: error instanceof Error ? error.message : "Falha ao desconectar.",
      });
    }
  };

  useEffect(() => {
    if (authChecking || !adminAuthorized) return;

    let cancelled = false;

    const run = async () => {
      if (bucket === "clientes") {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const token = await getAuthToken();
        const data = await listManagerPath(currentPath, bucket, token);
        if (cancelled) return;
        setFolders(data.folders);
        setFiles(data.files);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof AdminAuthError) return;
        console.error("Failed to load manager", error);
        toast({
          variant: "destructive",
          title: "Erro ao carregar gerenciador",
          description: error instanceof Error ? error.message : "Falha ao carregar dados.",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [authChecking, adminAuthorized, bucket, currentPath, toast, getAuthToken]);

  useEffect(() => {
    if (authChecking || !adminAuthorized) return;

    let cancelled = false;

    const run = async () => {
      try {
        const token = await getAuthToken();
        const sizes = await getBucketSizes(token);
        if (cancelled) return;
        setBucketSizes(sizes);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load bucket sizes", error);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [authChecking, adminAuthorized, getAuthToken]);

  if (authChecking) {
    return (
      <main className="min-h-screen bg-background px-6 py-10 md:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validando acesso administrativo...
          </div>
        </div>
      </main>
    );
  }

  if (!adminAuthorized) {
    return (
      <main className="min-h-screen bg-background px-6 py-10 md:px-10">
        <div className="mx-auto flex max-w-md flex-col gap-4 rounded-xl border border-border/60 bg-card p-6">
          <h1 className="text-lg font-semibold text-foreground">Acesso administrativo</h1>
          <p className="text-sm text-muted-foreground">
            Faça login com sua conta Google autorizada para acessar o painel de administração.
          </p>
          <Button onClick={handleAdminLogin} disabled={authChecking}>
            {authChecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Iniciando login...
              </>
            ) : (
              "Entrar com Google"
            )}
          </Button>
          <Button asChild variant="ghost">
            <Link to="/">Voltar para o site</Link>
          </Button>
        </div>
      </main>
    );
  }

  const canCreateFolder =
    (bucket === "site" && (currentPath === "albuns" || currentPath.startsWith("albuns/"))) ||
    (bucket === "clientes" && (currentPath === "clientes" || currentPath.startsWith("clientes/")));
  const canUploadToPath =
    (bucket === "site" && (currentPath === "home" || currentPath.startsWith("albuns/"))) ||
    (bucket === "clientes" && currentPath.startsWith("clientes/"));

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const breadcrumbs = currentPath ? currentPath.split("/").filter(Boolean) : [];

  const refresh = async () => {
    const token = await getAuthToken();
    const data = await listManagerPath(currentPath, bucket, token);
    setFolders(data.folders);
    setFiles(data.files);
  };

  const handleDeploy = async () => {
    setBusy(true);
    try {
      const token = await getAuthToken();
      const url = await buildManifest(token);
      toast({
        title: "Deploy concluído",
        description: url,
      });
    } catch (error) {
      if (error instanceof AdminAuthError) return;
      toast({
        variant: "destructive",
        title: "Erro no deploy",
        description: error instanceof Error ? error.message : "Falha ao gerar manifest.",
      });
    } finally {
      setBusy(false);
    }
  };

  const getFileBaseName = (name: string): string => {
    if (name.endsWith("__thumb.webp")) {
      return name.replace(/__thumb\.webp$/i, "");
    }
    if (name.endsWith("__preview.webp")) {
      return name.replace(/__preview\.webp$/i, "");
    }
    if (name.endsWith("__watermark.webp")) {
      return name.replace(/__watermark\.webp$/i, "");
    }

    const dotIndex = name.lastIndexOf(".");
    if (dotIndex > 0) {
      return name.slice(0, dotIndex);
    }

    return name;
  };

  const getFileDir = (path: string): string => {
    const normalized = String(path || "").replace(/\\/g, "/");
    const idx = normalized.lastIndexOf("/");
    return idx >= 0 ? normalized.slice(0, idx) : "";
  };

   const requestCrop = async (file: File, opts: { aspect: number; title: string }): Promise<File> => {
     const src = URL.createObjectURL(file);

     if (cropObjectUrlRef.current) {
       URL.revokeObjectURL(cropObjectUrlRef.current);
     }
     cropObjectUrlRef.current = src;
     cropFileRef.current = file;

     setCropImageSrc(src);
     setCropAspect(opts.aspect);
     setCropTitle(opts.title);
     setCropOpen(true);

     return await new Promise<File>((resolve, reject) => {
       cropResolveRef.current = resolve;
       cropRejectRef.current = reject;
     });
   };

  const handleUploadFiles = async (pickedFiles: File[]) => {
    if (!canUploadToPath) {
      toast({
        variant: "destructive",
        title: "Upload indisponível",
        description:
          bucket === "clientes"
            ? "Faça upload dentro de uma pasta em clientes/."
            : "Faça upload dentro de home/ ou dentro de uma pasta em albuns/.",
      });
      return;
    }

    if (pickedFiles.length === 0) {
      return;
    }

    const isHome = currentPath === "home";
    const aspect = isHome ? 9 / 16 : 4 / 5;
    const title = isHome ? "Cortar imagem (Home 9:16)" : "Cortar imagem (Álbum 4:5)";

    let authToken = "";
    try {
      authToken = await getAuthToken();
    } catch {
      return;
    }

    setBusy(true);
    setUploadProgress(0);
    setUploadingCount(pickedFiles.length);

    try {
      const isClientUpload = bucket === "clientes";
      let completed = 0;
      let failures = 0;

      if (isClientUpload) {
        const uploadFile = async (file: File) => {
          try {
            await uploadImageToPath(currentPath, file, bucket, authToken);
          } catch (error) {
            failures += 1;
            throw error;
          } finally {
            completed += 1;
            const pct = Math.min(100, Math.round((completed / pickedFiles.length) * 100));
            setUploadProgress(pct);
          }
        };

        const concurrency = 3;
        for (let i = 0; i < pickedFiles.length; i += concurrency) {
          const batch = pickedFiles.slice(i, i + concurrency);
          await Promise.allSettled(batch.map(uploadFile));
        }
      } else {
        for (const file of pickedFiles) {
          try {
            const prepared = await requestCrop(file, { aspect, title });
            await uploadImageToPath(currentPath, prepared, bucket, authToken);
          } catch (error) {
            failures += 1;
          } finally {
            completed += 1;
            const pct = Math.min(100, Math.round((completed / pickedFiles.length) * 100));
            setUploadProgress(pct);
          }
        }
      }

      await refresh();
      toast({
        title: "Upload concluído",
        description: failures > 0 ? `${failures} arquivo(s) falharam.` : undefined,
      });
    } catch (error) {
      if (error instanceof AdminAuthError) return;
      toast({
        variant: "destructive",
        title: "Erro no upload",
        description: error instanceof Error ? error.message : "Falha no upload.",
      });
    } finally {
      setBusy(false);
      setUploadingCount(0);
      setUploadProgress(0);
    }
  };

  const handleCreateFolder = async (folderName: string) => {
    if (!canCreateFolder || !folderName.trim()) return;

    setBusy(true);
    try {
      const token = await getAuthToken();
      await createFolder(currentPath, folderName.trim(), bucket, token);
      await refresh();
      toast({ title: "Pasta criada" });
    } catch (error) {
      if (error instanceof AdminAuthError) return;
      toast({
        variant: "destructive",
        title: "Erro ao criar pasta",
        description: error instanceof Error ? error.message : "Falha ao criar.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRenameFolder = async (folder: ManagerFolderItem) => {
    const newName = window.prompt("Novo nome da pasta:", folder.name);
    if (!newName || newName.trim() === folder.name) return;

    setBusy(true);
    try {
      const token = await getAuthToken();
      await renameFolder(folder.path, newName.trim(), bucket, token);
      await refresh();
      toast({ title: "Pasta renomeada" });
    } catch (error) {
      if (error instanceof AdminAuthError) return;
      toast({
        variant: "destructive",
        title: "Erro ao renomear pasta",
        description: error instanceof Error ? error.message : "Falha ao renomear pasta.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteFolder = async (folder: ManagerFolderItem) => {
    const ok = window.confirm(`Apagar a pasta '${folder.name}' e todo o conteúdo?`);
    if (!ok) return;

    setBusy(true);
    try {
      const token = await getAuthToken();
      await deleteFolder(folder.path, bucket, token);
      await refresh();
      toast({ title: "Pasta apagada" });
    } catch (error) {
      if (error instanceof AdminAuthError) return;
      toast({
        variant: "destructive",
        title: "Erro ao apagar pasta",
        description: error instanceof Error ? error.message : "Falha ao apagar pasta.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRenameFile = async (file: ManagerFileItem) => {
    const newName = window.prompt("Novo nome do arquivo:", file.name);
    if (!newName || newName.trim() === file.name) return;

    setBusy(true);
    try {
      const token = await getAuthToken();
      await renameFile(file.path, newName.trim(), bucket, token);
      await refresh();
      toast({ title: "Arquivo renomeado" });
    } catch (error) {
      if (error instanceof AdminAuthError) return;
      toast({
        variant: "destructive",
        title: "Erro ao renomear arquivo",
        description: error instanceof Error ? error.message : "Falha ao renomear arquivo.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteFile = async (file: ManagerFileItem) => {
    const ok = window.confirm(`Apagar o arquivo '${file.name}'?`);
    if (!ok) return;

    setBusy(true);
    try {
      const base = getFileBaseName(file.name);
      const dir = getFileDir(file.path);
      const prefix = dir ? `${dir}/` : "";

      const targets = new Map<string, ManagerFileItem>();

      const thumbName = `${base}__thumb.webp`;
      const previewName = `${base}__preview.webp`;
      const watermarkName = `${base}__watermark.webp`;

      for (const candidate of files) {
        if (!candidate.path.startsWith(prefix)) continue;
        if (candidate.name === thumbName) {
          targets.set(candidate.path, candidate);
        }
        if (candidate.name === previewName) {
          targets.set(candidate.path, candidate);
        }
        if (candidate.name === watermarkName) {
          targets.set(candidate.path, candidate);
        }
        if (candidate.name.startsWith(`${base}.`) && !candidate.name.includes("__")) {
          targets.set(candidate.path, candidate);
        }
      }

      if (targets.size === 0) {
        targets.set(file.path, file);
      }

      const token = await getAuthToken();
      await Promise.all(Array.from(targets.keys()).map((path) => deleteFile(path, bucket, token)));
      await refresh();
      toast({ title: "Arquivo apagado" });
    } catch (error) {
      if (error instanceof AdminAuthError) return;
      toast({
        variant: "destructive",
        title: "Erro ao apagar arquivo",
        description: error instanceof Error ? error.message : "Falha ao apagar arquivo.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-6 py-10 md:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Painel administrativo</p>
              <h1 className="text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
                {bucket === "clientes" ? "Clientes" : "Gerenciador de arquivos"}
              </h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>

          {bucketSizes && (
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div>
                <span className="font-medium">Site:</span> {formatBytes(bucketSizes.site)}
              </div>
              <div>
                <span className="font-medium">Clientes:</span> {formatBytes(bucketSizes.clientes)}
              </div>
              <div>
                <span className="font-medium">Total:</span> {formatBytes(bucketSizes.total)}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <Button asChild variant="link" className="px-0">
              <Link to="/">Voltar para o site</Link>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={bucket === "site" ? "default" : "outline"}
                disabled={busy}
                onClick={() => {
                  setLoading(true);
                  setBucket("site");
                  setCurrentPath("");
                }}
              >
                Site
              </Button>
              <Button
                size="sm"
                variant={bucket === "clientes" ? "default" : "outline"}
                disabled={busy}
                onClick={() => {
                  setLoading(true);
                  setBucket("clientes");
                  setCurrentPath("clientes");
                }}
              >
                Clientes
              </Button>
            </div>
          </div>

          {bucket === "site" && (
            <div>
              <Button variant="outline" disabled={busy} onClick={handleDeploy}>
                {busy ? "Processando..." : "Deploy"}
              </Button>
            </div>
          )}

          {uploadingCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Enviando {uploadingCount} {uploadingCount === 1 ? "foto" : "fotos"}...
                </span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}
        </header>

        {bucket === "clientes" ? (
          <AdminClientsPanel />
        ) : (
          <>
        <section className="rounded-lg border border-border/60 bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button size="sm" variant="outline" onClick={() => setCurrentPath("")}
            >
              Raiz
            </Button>

            {breadcrumbs.map((segment, index) => {
              const path = breadcrumbs.slice(0, index + 1).join("/");
              return (
                <Button
                  key={path}
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPath(path)}
                >
                  {segment}
                </Button>
              );
            })}
            <span className="text-muted-foreground">/ {currentPath || ""}</span>
          </div>

          {!canUploadToPath && (
            <p className="text-xs text-muted-foreground">
              {bucket === "clientes"
                ? "Upload só disponível dentro de uma pasta em clientes/."
                : "Upload só disponível em home/ ou dentro de uma pasta em albuns/."}
            </p>
          )}
          {!canCreateFolder && (
            <p className="text-xs text-muted-foreground">
              {bucket === "clientes"
                ? "Criar pasta só disponível quando estiver em clientes/."
                : "Criar pasta só disponível quando estiver em albuns/."}
            </p>
          )}
        </section>

        <section className="rounded-lg border border-border/60 bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Pastas</h2>
          <ul className="space-y-2">
            {loading && (
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </li>
            )}

            {folders.map((folder) => {
              const isRoot = folder.path === "home" || folder.path === "albuns" || folder.path === "clientes";
              const canEdit =
                (bucket === "site" && folder.path.startsWith("albuns/") && !isRoot) ||
                (bucket === "clientes" && folder.path.startsWith("clientes/") && !isRoot);

              return (
                <li
                  key={folder.path}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/40 px-3 py-2"
                >
                  <span className="text-left text-sm">📁 {folder.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-md border border-border/40 p-2 hover:bg-accent"
                      onClick={() => setCurrentPath(folder.path)}
                      aria-label="Abrir pasta"
                      type="button"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>

                    {canEdit && (
                      <>
                        <button
                          className="rounded-md border border-border/40 p-2 hover:bg-accent disabled:opacity-50"
                          onClick={() => handleRenameFolder(folder)}
                          aria-label="Renomear pasta"
                          type="button"
                          disabled={busy}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-md border border-border/40 p-2 hover:bg-accent disabled:opacity-50"
                          onClick={() => handleDeleteFolder(folder)}
                          aria-label="Apagar pasta"
                          type="button"
                          disabled={busy}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}

            {folders.length === 0 && !loading && (
              <li className="text-sm text-muted-foreground">Nenhuma pasta encontrada.</li>
            )}
          </ul>
        </section>

        <section className="rounded-lg border border-border/60 bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Arquivos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {files
              .filter((file) => !file.name.includes("__"))
              .map((file) => {
                const displayUrl = file.thumbUrl || file.previewUrl || file.url;
                const linkUrl = file.originalUrl || file.url;

                return (
                  <div key={file.path} className="relative overflow-hidden rounded border border-border/40 bg-background">
                    <a href={linkUrl} target="_blank" rel="noreferrer">
                      <img src={displayUrl} alt={file.name} className="aspect-square w-full object-cover" loading="lazy" />
                    </a>

                    <div className="absolute right-2 top-2 flex items-center gap-2">
                      <button
                        className="rounded-md border border-border/40 bg-background/80 p-2 backdrop-blur hover:bg-accent disabled:opacity-50"
                        onClick={() => handleDeleteFile(file)}
                        aria-label="Apagar arquivo"
                        type="button"
                        disabled={busy}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          {files.filter((file) => !file.name.includes("__")).length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">Nenhuma imagem neste diretório.</p>
          )}
        </section>
          </>
        )}
      </div>

      <input
        id="admin-upload-hidden"
        className="hidden"
        type="file"
        multiple
        accept="image/*"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          event.target.value = "";
          handleUploadFiles(picked).catch((error) => {
            console.error("Upload failed", error);
          });
        }}
      />

      {bucket === "site" && canUploadToPath && (
        <button
          type="button"
          aria-label="Upload"
          disabled={busy}
          onClick={() => document.getElementById("admin-upload-hidden")?.click()}
          className={
            canCreateFolder
              ? "fixed bottom-6 right-6 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center disabled:opacity-50"
              : "fixed bottom-6 right-6 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center disabled:opacity-50"
          }
          style={canCreateFolder ? { right: "5.5rem" } : undefined}
        >
          <FileUp className="h-5 w-5" />
        </button>
      )}

      {bucket === "site" && canCreateFolder && (
        <button
          type="button"
          aria-label="Criar pasta"
          disabled={busy}
          onClick={() => {
            const folderName = window.prompt("Nome da nova pasta:");
            if (!folderName) return;
            handleCreateFolder(folderName).catch((error) => {
              console.error("Create folder failed", error);
            });
          }}
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center disabled:opacity-50"
        >
          <FolderPlus className="h-5 w-5" />
        </button>
      )}

      <ImageCropDialog
        open={cropOpen}
        imageSrc={cropImageSrc}
        aspect={cropAspect}
        title={cropTitle}
        onCancel={() => {
          setCropOpen(false);
          const reject = cropRejectRef.current;
          cropResolveRef.current = null;
          cropRejectRef.current = null;
          cropFileRef.current = null;

          if (cropObjectUrlRef.current) {
            URL.revokeObjectURL(cropObjectUrlRef.current);
            cropObjectUrlRef.current = null;
          }

          reject?.(new Error("Crop cancelled"));
        }}
        onConfirm={async (area: CropAreaPixels) => {
          const file = cropFileRef.current;
          if (!file) return;

          try {
            const cropped = await cropImageFile(file, area);
            setCropOpen(false);

            const resolve = cropResolveRef.current;
            cropResolveRef.current = null;
            cropRejectRef.current = null;
            cropFileRef.current = null;

            if (cropObjectUrlRef.current) {
              URL.revokeObjectURL(cropObjectUrlRef.current);
              cropObjectUrlRef.current = null;
            }

            resolve?.(cropped);
          } catch (error) {
            setCropOpen(false);

            const reject = cropRejectRef.current;
            cropResolveRef.current = null;
            cropRejectRef.current = null;
            cropFileRef.current = null;

            if (cropObjectUrlRef.current) {
              URL.revokeObjectURL(cropObjectUrlRef.current);
              cropObjectUrlRef.current = null;
            }

            reject?.(error);
          }
        }}
      />
    </main>
  );
};

export default Admin;
