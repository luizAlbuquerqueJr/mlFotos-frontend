import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, FileUp, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  createFolder,
  deleteFile,
  deleteFolder,
  listManagerPath,
  renameFile,
  renameFolder,
  type ManagerFileItem,
  type ManagerFolderItem,
  uploadImageToPath,
} from "@/lib/api";

const Admin = () => {
  const { toast } = useToast();
  const [currentPath, setCurrentPath] = useState("");
  const [folders, setFolders] = useState<ManagerFolderItem[]>([]);
  const [files, setFiles] = useState<ManagerFileItem[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listManagerPath(currentPath)
      .then((data) => {
        setFolders(data.folders);
        setFiles(data.files);
      })
      .catch((error) => {
        console.error("Failed to load manager", error);
        toast({
          variant: "destructive",
          title: "Erro ao carregar gerenciador",
          description: error instanceof Error ? error.message : "Falha ao carregar dados.",
        });
      });
  }, [currentPath, toast]);

  const canCreateFolder = currentPath === "albuns";
  const canUploadToPath = currentPath === "home" || currentPath.startsWith("albuns/");

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [] as string[];
    return currentPath.split("/").filter(Boolean);
  }, [currentPath]);

  const refresh = async () => {
    const data = await listManagerPath(currentPath);
    setFolders(data.folders);
    setFiles(data.files);
  };

  const handleUploadFiles = async (pickedFiles: File[]) => {
    if (!canUploadToPath) {
      toast({
        variant: "destructive",
        title: "Upload indisponível",
        description: "Faça upload dentro de home/ ou dentro de uma pasta em albuns/.",
      });
      return;
    }

    if (pickedFiles.length === 0) {
      return;
    }

    setBusy(true);
    try {
      for (const file of pickedFiles) {
        await uploadImageToPath(currentPath, file);
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
      await createFolder(currentPath, folderName.trim());
      await refresh();
      toast({ title: "Pasta criada" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao criar pasta",
        description: error instanceof Error ? error.message : "Falha ao criar pasta.",
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
      await renameFolder(folder.path, newName.trim());
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
      await deleteFolder(folder.path);
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
      await renameFile(file.path, newName.trim());
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
      await deleteFile(file.path);
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
          <h1 className="text-3xl" style={{ fontFamily: "var(--font-serif)" }}>Gerenciador de arquivos</h1>
          <Button asChild variant="link" className="px-0">
            <Link to="/">Voltar para o site</Link>
          </Button>
        </header>

        <section className="rounded-lg border border-border/60 bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button size="sm" variant="outline" onClick={() => setCurrentPath("")}>Raiz</Button>
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
            <p className="text-xs text-muted-foreground">Upload só disponível em home/ ou dentro de uma pasta em albuns/.</p>
          )}
          {!canCreateFolder && (
            <p className="text-xs text-muted-foreground">Criar pasta só disponível quando estiver em albuns/.</p>
          )}
        </section>

        <section className="rounded-lg border border-border/60 bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Pastas</h2>
          <ul className="space-y-2">
            {folders.map((folder) => {
              const isRoot = folder.path === "home" || folder.path === "albuns";
              const canEdit = folder.path.startsWith("albuns/") && !isRoot;

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

            {folders.length === 0 && (
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

            {files.length === 0 && (
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

      {!canCreateFolder && canUploadToPath && (
        <button
          type="button"
          aria-label="Upload"
          disabled={busy}
          onClick={() => document.getElementById("admin-upload-hidden")?.click()}
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center disabled:opacity-50"
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
    </main>
  );
};

export default Admin;
