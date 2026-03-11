import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, FileUp, FolderPlus, Loader2, MessageCircle, Pencil, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import ImageCropDialog from "@/components/ImageCropDialog";
import { useToast } from "@/hooks/use-toast";
import { cropImageFile, type CropAreaPixels } from "@/lib/imageCrop";
import {
  buildManifest,
  createUser,
  createFolder,
  deleteFile,
  deleteUser,
  deleteFolder,
  getUserById,
  listUsers,
  listManagerPath,
  renameFile,
  renameFolder,
  updateUser,
  type StorageBucketKey,
  type UserRecord,
  type ManagerFileItem,
  type ManagerFolderItem,
  uploadImageToPath,
} from "@/lib/api";

const Admin = () => {
  const { toast } = useToast();
  const [currentPath, setCurrentPath] = useState("");
  const [bucket, setBucket] = useState<StorageBucketKey>("site");
  const [folders, setFolders] = useState<ManagerFolderItem[]>([]);
  const [files, setFiles] = useState<ManagerFileItem[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentClientName, setCurrentClientName] = useState<string>("");

  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropTitle, setCropTitle] = useState<string>("");
  const [cropAspect, setCropAspect] = useState<number>(9 / 16);

  const cropFileRef = useRef<File | null>(null);
  const cropObjectUrlRef = useRef<string | null>(null);
  const cropResolveRef = useRef<((file: File) => void) | null>(null);
  const cropRejectRef = useRef<((reason?: unknown) => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      const isUsersRoot = bucket === "clientes" && currentPath === "clientes";

      try {
        if (isUsersRoot) {
          const data = await listUsers();
          if (cancelled) return;
          setUsers(data);
          setFolders([]);
          setFiles([]);
          return;
        }

        const data = await listManagerPath(currentPath, bucket);
        if (cancelled) return;
        setFolders(data.folders);
        setFiles(data.files);
        setUsers([]);
      } catch (error) {
        if (cancelled) return;
        const isUsersRootNow = bucket === "clientes" && currentPath === "clientes";
        console.error(isUsersRootNow ? "Failed to load users" : "Failed to load manager", error);
        toast({
          variant: "destructive",
          title: isUsersRootNow ? "Erro ao carregar usuários" : "Erro ao carregar gerenciador",
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
  }, [bucket, currentPath, toast]);

  const currentClientId = useMemo(() => {
    if (bucket !== "clientes") return "";
    if (!currentPath.startsWith("clientes/")) return "";

    const parts = currentPath.split("/").filter(Boolean);
    return parts.length >= 2 ? parts[1] : "";
  }, [bucket, currentPath]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!currentClientId) {
        setCurrentClientName("");
        return;
      }

      try {
        const user = await getUserById(currentClientId);
        if (cancelled) return;
        setCurrentClientName(user.name);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load client name", error);
        setCurrentClientName("");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [currentClientId]);

  const canCreateFolder =
    (bucket === "site" && (currentPath === "albuns" || currentPath.startsWith("albuns/"))) ||
    (bucket === "clientes" && (currentPath === "clientes" || currentPath.startsWith("clientes/")));
  const canUploadToPath =
    (bucket === "site" && (currentPath === "home" || currentPath.startsWith("albuns/"))) ||
    (bucket === "clientes" && currentPath.startsWith("clientes/"));

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [] as string[];
    return currentPath.split("/").filter(Boolean);
  }, [currentPath]);

  const refresh = async () => {
    const isUsersRoot = bucket === "clientes" && currentPath === "clientes";
    if (isUsersRoot) {
      const data = await listUsers();
      setUsers(data);
      setFolders([]);
      setFiles([]);
      return;
    }

    const data = await listManagerPath(currentPath, bucket);
    setFolders(data.folders);
    setFiles(data.files);
    setUsers([]);
  };

  const handleDeploy = async () => {
    setBusy(true);
    try {
      const url = await buildManifest();
      toast({
        title: "Deploy concluído",
        description: url,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro no deploy",
        description: error instanceof Error ? error.message : "Falha ao gerar manifest.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleShareUserWhatsapp = (user: UserRecord) => {
    const url = `${window.location.origin}/clientes?id=${encodeURIComponent(user.id)}`;
    const text = `Olá ${user.name}! Aqui está o link das suas fotos: ${url}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
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

    setBusy(true);
    try {
      for (const file of pickedFiles) {
        const prepared = bucket === "clientes" ? file : await requestCrop(file, { aspect, title });
        await uploadImageToPath(currentPath, prepared, bucket);
      }
      await refresh();
      toast({ title: "Upload concluído" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro no upload",
        description: error instanceof Error ? error.message : "Falha no upload.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateFolder = async (folderName: string) => {
    if (!canCreateFolder || !folderName.trim()) return;

    setBusy(true);
    try {
      const normalized = folderName.trim();
      const isUsersRoot = bucket === "clientes" && currentPath === "clientes";

      if (isUsersRoot) {
        await createUser(normalized);
      } else {
        await createFolder(currentPath, normalized, bucket);
      }
      await refresh();
      toast({ title: isUsersRoot ? "Usuário criado" : "Pasta criada" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: bucket === "clientes" && currentPath === "clientes" ? "Erro ao criar usuário" : "Erro ao criar pasta",
        description: error instanceof Error ? error.message : "Falha ao criar.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRenameUser = async (user: UserRecord) => {
    const newName = window.prompt("Novo nome do cliente:", user.name);
    if (!newName || newName.trim() === user.name) return;

    setBusy(true);
    try {
      await updateUser(user.id, { name: newName.trim() });
      await refresh();
      toast({ title: "Usuário atualizado" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar usuário",
        description: error instanceof Error ? error.message : "Falha ao atualizar.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteUser = async (user: UserRecord) => {
    const ok = window.confirm(`Apagar o usuário '${user.name}' e todas as fotos?`);
    if (!ok) return;

    setBusy(true);
    try {
      await deleteUser(user.id);
      await refresh();
      toast({ title: "Usuário apagado" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao apagar usuário",
        description: error instanceof Error ? error.message : "Falha ao apagar.",
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
      await renameFolder(folder.path, newName.trim(), bucket);
      await refresh();
      toast({ title: "Pasta renomeada" });
    } catch (error) {
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
      await deleteFolder(folder.path, bucket);
      await refresh();
      toast({ title: "Pasta apagada" });
    } catch (error) {
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
      await renameFile(file.path, newName.trim(), bucket);
      await refresh();
      toast({ title: "Arquivo renomeado" });
    } catch (error) {
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
      await deleteFile(file.path, bucket);
      await refresh();
      toast({ title: "Arquivo apagado" });
    } catch (error) {
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
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Painel administrativo</p>
          <h1 className="text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
            Gerenciador de arquivos
          </h1>

          {bucket === "clientes" && currentClientId && currentClientName && (
            <p className="text-sm text-muted-foreground">
              Cliente: <span className="text-foreground">{currentClientName}</span>
            </p>
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
        </header>

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

            {bucket === "clientes" && currentPath === "clientes" &&
              users.map((user) => (
                <li
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/40 px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-left text-sm">
                    <User className="h-4 w-4" />
                    {user.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-md border border-border/40 p-2 hover:bg-accent disabled:opacity-50"
                      onClick={() => handleShareUserWhatsapp(user)}
                      aria-label="Compartilhar no WhatsApp"
                      type="button"
                      disabled={busy}
                      title="Compartilhar link no WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>

                    <button
                      className="rounded-md border border-border/40 p-2 hover:bg-accent"
                      onClick={() => setCurrentPath(`clientes/${user.id}`)}
                      aria-label="Abrir usuário"
                      type="button"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>

                    <button
                      className="rounded-md border border-border/40 p-2 hover:bg-accent disabled:opacity-50"
                      onClick={() => handleRenameUser(user)}
                      aria-label="Renomear usuário"
                      type="button"
                      disabled={busy}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded-md border border-border/40 p-2 hover:bg-accent disabled:opacity-50"
                      onClick={() => handleDeleteUser(user)}
                      aria-label="Apagar usuário"
                      type="button"
                      disabled={busy}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}

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

            {folders.length === 0 && users.length === 0 && !loading && (
              <li className="text-sm text-muted-foreground">Nenhuma pasta encontrada.</li>
            )}
          </ul>
        </section>

        <section className="rounded-lg border border-border/60 bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Arquivos</h2>
          <ul className="space-y-2">
            {files.map((file) => (
              <li
                key={file.path}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/40 px-3 py-2"
              >
                <a href={file.url} target="_blank" rel="noreferrer" className="text-sm hover:underline">
                  {file.name}
                </a>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md border border-border/40 p-2 hover:bg-accent disabled:opacity-50"
                    onClick={() => handleRenameFile(file)}
                    aria-label="Renomear arquivo"
                    type="button"
                    disabled={busy}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-md border border-border/40 p-2 hover:bg-accent disabled:opacity-50"
                    onClick={() => handleDeleteFile(file)}
                    aria-label="Apagar arquivo"
                    type="button"
                    disabled={busy}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}

            {files.length === 0 && !loading && (
              <li className="text-sm text-muted-foreground">Nenhum arquivo neste diretório.</li>
            )}
          </ul>
        </section>
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

      {canUploadToPath && (
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

      {canCreateFolder && (
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
