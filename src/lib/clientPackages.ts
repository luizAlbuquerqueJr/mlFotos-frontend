export type ClientPhotoStatus = "selectable" | "released";

export interface ClientContract {
  contractedCount: number;
  contractedPrice: number;
  extraPhotoPrice: number;
  extraDiscountEvery: number;
  extraDiscountValue: number;
}

export interface ClientPhoto {
  id: string;
  name: string;
  previewUrl: string;
  originalUrl: string;
  status: ClientPhotoStatus;
  favorited: boolean;
}

export interface ClientPackage {
  id: string;
  name: string;
  contract: ClientContract;
  photos: ClientPhoto[];
  selectionSubmittedAt?: string;
  photoSelectionEnabled?: boolean;
}

export function canSelectPhotos(client: ClientPackage): boolean {
  return client.photoSelectionEnabled === true;
}

export interface SelectionQuote {
  selectedCount: number;
  ownedCount: number;
  extraCount: number;
  remainingContractSlots: number;
  includesContract: boolean;
  contractedPrice: number;
  extraUnitPrice: number;
  extraSubtotal: number;
  discountAmount: number;
  alreadyPaid: number;
  amountDue: number;
  total: number;
  minRequired: number;
  canSubmit: boolean;
  appliesExtraDiscount: boolean;
  couponCount: number;
  couponValue: number;
  nextCouponValue: number;
  extrasUntilDiscount: number;
  extrasInDiscountCycle: number;
  extraDiscountEvery: number;
  extraDiscountValue: number;
  hasExtraDiscount: boolean;
  couponShakeLevel: 0 | 1 | 2 | 3 | 4;
  justUnlockedCoupon: boolean;
}

const PHOTOGRAPHER_WHATSAPP = "5581992621285";

export const DEFAULT_CONTRACT: ClientContract = {
  contractedCount: 20,
  contractedPrice: 200,
  extraPhotoPrice: 5,
  extraDiscountEvery: 5,
  extraDiscountValue: 5,
};

export function applyPhotoFavorite(
  client: ClientPackage,
  photoId: string,
  favorited: boolean
): ClientPackage {
  return {
    ...client,
    selectionSubmittedAt: undefined,
    photos: client.photos.map((photo) => (photo.id === photoId ? { ...photo, favorited } : photo)),
  };
}

export function countPendingFavorites(client: ClientPackage): number {
  return client.photos.filter((photo) => photo.status === "selectable" && photo.favorited).length;
}

export function countReleasedPhotos(client: ClientPackage): number {
  return client.photos.filter((photo) => photo.status === "released").length;
}

function couponShakeLevel(
  extrasInCycle: number,
  extraCount: number,
  justUnlocked: boolean
): 0 | 1 | 2 | 3 | 4 {
  if (justUnlocked || extraCount <= 0) return 0;
  if (extrasInCycle <= 1) return 0;
  if (extrasInCycle === 2) return 1;
  if (extrasInCycle === 3) return 2;
  return 3;
}

export function quoteSelection(client: ClientPackage): SelectionQuote {
  const ownedCount = countReleasedPhotos(client);
  const selectedCount = countPendingFavorites(client);
  const remainingContractSlots = Math.max(0, client.contract.contractedCount - ownedCount);
  const extraCount = Math.max(0, selectedCount - remainingContractSlots);
  const includesContract = ownedCount === 0 && selectedCount >= client.contract.contractedCount;
  const extraSubtotal = extraCount * client.contract.extraPhotoPrice;
  const extraDiscountEvery = client.contract.extraDiscountEvery;
  const extraDiscountValue = client.contract.extraDiscountValue;
  const hasExtraDiscount = extraDiscountEvery > 0 && extraDiscountValue > 0;
  const extrasInDiscountCycle = hasExtraDiscount ? extraCount % extraDiscountEvery : 0;
  const extrasUntilDiscount = hasExtraDiscount
    ? extrasInDiscountCycle === 0
      ? extraDiscountEvery
      : extraDiscountEvery - extrasInDiscountCycle
    : 0;
  const couponCount = hasExtraDiscount ? Math.floor(extraCount / extraDiscountEvery) : 0;
  const discountAmount = couponCount * extraDiscountValue;
  const couponValue = discountAmount;
  const nextCouponValue = couponValue + extraDiscountValue;
  const contractedPrice = client.contract.contractedPrice;
  const alreadyPaid = contractedPrice;
  const amountDue = extraSubtotal - discountAmount;
  const minRequired = ownedCount === 0 ? client.contract.contractedCount : 1;
  const justUnlockedCoupon = couponCount > 0 && extrasInDiscountCycle === 0;

  return {
    selectedCount,
    ownedCount,
    extraCount,
    remainingContractSlots,
    includesContract,
    contractedPrice,
    extraUnitPrice: client.contract.extraPhotoPrice,
    extraSubtotal,
    discountAmount,
    alreadyPaid,
    amountDue,
    total: amountDue,
    minRequired,
    canSubmit: selectedCount >= minRequired,
    appliesExtraDiscount: couponCount > 0,
    couponCount,
    couponValue,
    nextCouponValue,
    extrasUntilDiscount,
    extrasInDiscountCycle,
    extraDiscountEvery,
    extraDiscountValue,
    hasExtraDiscount,
    couponShakeLevel: couponShakeLevel(extrasInDiscountCycle, extraCount, justUnlockedCoupon),
    justUnlockedCoupon,
  };
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function buildSelectionWhatsAppMessage(_client: ClientPackage): string {
  return "Já escolhi minhas fotos no site Monica Lima, fico no aguardo da sua liberação.";
}

export function openSelectionWhatsApp(client: ClientPackage): boolean {
  const quote = quoteSelection(client);
  if (!quote.canSubmit) return false;
  const url = `https://wa.me/${PHOTOGRAPHER_WHATSAPP}?text=${encodeURIComponent(buildSelectionWhatsAppMessage(client))}`;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

export function normalizeClientContract(input?: Partial<ClientContract> | null): ClientContract {
  return {
    ...DEFAULT_CONTRACT,
    ...(input || {}),
  };
}
