import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import PhotoViewer from "@/components/PhotoViewer";
import { useToast } from "@/hooks/use-toast";
import { getUserByCode, listManagerPath, type ManagerFileItem, type UserRecord } from "@/lib/api";

function buildAlbumFromFiles(user: UserRecord, files: ManagerFileItem[]) {
  return {
    id: user.id,
    title: `Fotos de ${user.name}`,
    cover: files[0]?.url ?? "",
    photos: files.map((f) => ({ src: f.url, alt: f.name })),
  };
}

function normalizeClientCode(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

const ClientGallery = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialCode = useMemo(() => {
    const fromUrl = searchParams.get("code");
    return typeof fromUrl === "string" ? fromUrl.trim() : "";
  }, [searchParams]);

  const [codeInput, setCodeInput] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<UserRecord | null>(null);
  const [files, setFiles] = useState<ManagerFileItem[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    setCodeInput(initialCode);
  }, [initialCode]);

  const handleValidate = async () => {
    const normalized = normalizeClientCode(codeInput);
    if (!normalized) {
      toast({
        variant: "destructive",
        title: "Informe o código",
        description: "Digite o código do cliente para acessar as fotos.",
      });
      return;
    }

    if (!/^[A-HJ-NP-Z2-9]{12}$/.test(normalized)) {
      toast({
        variant: "destructive",
        title: "Código inválido",
        description: "O código deve ter 12 caracteres. Verifique e tente novamente.",
      });
      return;
    }

    setBusy(true);
    try {
      const resolvedUser = await getUserByCode(normalized);
      setUser(resolvedUser);
      setSearchParams({ code: normalized });

      const folderPath = `clientes/${resolvedUser.id}`;
      const listing = await listManagerPath(folderPath, "clientes");
      setFiles(listing.files);

      toast({ title: "Código validado" });
    } catch (error) {
      setUser(null);
      setFiles([]);

      toast({
        variant: "destructive",
        title: "Código inválido",
        description: error instanceof Error ? error.message : "Não foi possível validar o código.",
      });
    } finally {
      setBusy(false);
    }
  };

  const album = useMemo(() => {
    if (!user) return null;
    if (files.length === 0) return null;
    return buildAlbumFromFiles(user, files);
  }, [files, user]);

  return (
    <main className="min-h-screen bg-background w-full lg:max-w-[800px] lg:mx-auto">
      <Header />

      <div className="px-6 md:px-10 pt-28 pb-10 space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Área do cliente</p>
          <h1 className="text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
            Suas fotos
          </h1>

          <div className="flex flex-wrap items-center gap-4">
            <Button asChild variant="link" className="px-0">
              <Link to="/">Voltar para o site</Link>
            </Button>
          </div>
        </header>

        <section className="rounded-lg border border-border/60 bg-card p-5 space-y-3">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground" htmlFor="client-code">
              Código do cliente
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

        <section className="rounded-lg border border-border/60 bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Boas práticas</h2>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Para manter a melhor qualidade ao postar no WhatsApp e no Instagram, prefira baixar a foto e publicar o arquivo
              original (evite "reenviar" várias vezes a mesma imagem).
            </p>
            <p>
              No WhatsApp, se possível, envie como <span className="text-foreground">Documento</span> para evitar compressão.
            </p>
            <p>
              No Instagram, evite capturas de tela e edições repetidas; publique a foto direto do arquivo e, se for recortar,
              faça isso apenas uma vez.
            </p>
            <p>
              Evite fotos em formato de <span className="text-foreground">grid</span> (por exemplo, 4 fotos em uma só), pois
              isso reduz a resolução de cada foto e pode deixar a imagem com aparência de baixa qualidade.
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-border/60 bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Fotos</h2>

          {!user && (
            <p className="text-sm text-muted-foreground">Informe seu código para visualizar as fotos.</p>
          )}

          {user && files.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma foto disponível no momento.</p>
          )}

          {user && files.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {files.map((file, index) => (
                <button
                  key={file.path}
                  type="button"
                  className="group relative overflow-hidden rounded border border-border/40 bg-muted/10"
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
              ))}
            </div>
          )}
        </section>
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
