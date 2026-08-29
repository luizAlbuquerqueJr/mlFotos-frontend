import { useCallback, useEffect, useState } from "react";
import {
  createUser,
  deleteUser,
  getClientPackage,
  listClientPackages,
  notifyClientSelection,
  releaseClientPhotos,
  toggleClientPhotoFavorite,
  updateUser,
} from "@/lib/api";
import { DEFAULT_CONTRACT, type ClientContract, type ClientPackage } from "@/lib/clientPackages";

export function useClientPackages(authToken: string | null) {
  const [clients, setClients] = useState<ClientPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!authToken) {
      setClients([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await listClientPackages(authToken);
      setClients(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os clientes.");
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { clients, loading, error, reload, setClients };
}

export function useClientPackage(id: string | null | undefined) {
  const [client, setClient] = useState<ClientPackage | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const normalized = String(id || "").trim();
    if (!normalized) {
      setClient(undefined);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setClient(await getClientPackage(normalized));
    } catch (err) {
      setClient(undefined);
      setError(err instanceof Error ? err.message : "Não foi possível abrir as fotos.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { client, loading, error, reload, setClient };
}

export async function createClientOnApi(
  name: string,
  authToken: string,
  contract: ClientContract = { ...DEFAULT_CONTRACT }
) {
  return createUser(name, authToken, contract);
}

export async function renameClientOnApi(id: string, name: string, authToken: string) {
  return updateUser(id, { name }, authToken);
}

export async function updateClientContractOnApi(
  id: string,
  contract: Partial<ClientContract>,
  authToken: string
) {
  return updateUser(id, { contract }, authToken);
}

export async function deleteClientOnApi(id: string, authToken: string) {
  await deleteUser(id, authToken);
}

export async function toggleFavoriteOnApi(id: string, photoId: string, favorited: boolean) {
  return toggleClientPhotoFavorite(id, photoId, favorited);
}

export async function notifySelectionOnApi(id: string) {
  return notifyClientSelection(id);
}

export async function releasePhotosOnApi(id: string, authToken: string) {
  return releaseClientPhotos(id, authToken);
}
