import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "@/integrations/firebase/client";

export interface StoreProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  price: number;
  originalPrice: number;
  discount: number;
  image: string;
  images: string[];
  features: string[];
  available: boolean;
  minDeposit: number;
  maxInstallmentMonths: number;
  stockCount: number;
  totalStock: number;
  createdAt?: unknown;
  legacySupabaseId?: string;
}

type ProductInput = Omit<StoreProduct, "id" | "image" | "discount"> & {
  images: string[];
};

const productsCollection = collection(firestore, "products");
const productImagesCollection = collection(firestore, "productImages");

export const compressProductImage = async (file: File): Promise<string> => {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} is not a supported image file.`);
  }

  const source = await createImageBitmap(file);
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not process this image.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close();

  let quality = 0.72;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > 165_000 && quality > 0.35) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > 165_000) {
    throw new Error("This image is too large after compression. Please choose a smaller image.");
  }
  return dataUrl;
};

const makeThumbnail = async (dataUrl: string): Promise<string> => {
  const response = await fetch(dataUrl);
  const bitmap = await createImageBitmap(await response.blob());
  const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create product thumbnail.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let quality = 0.5;
  let thumbnail = canvas.toDataURL("image/jpeg", quality);
  while (thumbnail.length > 35_000 && quality > 0.2) {
    quality -= 0.08;
    thumbnail = canvas.toDataURL("image/jpeg", quality);
  }
  if (thumbnail.length > 35_000) {
    throw new Error("Could not reduce the product thumbnail enough.");
  }
  return thumbnail;
};

const readImageValue = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of ["dataUrl", "url", "imageUrl", "downloadURL", "downloadUrl", "src", "image", "base64"]) {
    if (typeof record[key] === "string" && (record[key] as string).trim()) {
      return (record[key] as string).trim();
    }
  }
  return "";
};

const normalizeProduct = (id: string, data: Record<string, unknown>, imageRecords: string[] = []): StoreProduct => {
  // Older SomiSteam records stored the full photo array directly on products.images.
  // Newer records store full photos in productImages and keep a small products.image thumbnail.
  const legacyImages = Array.isArray(data.images)
    ? data.images.map(readImageValue).filter(Boolean)
    : [];
  const allImages = Array.from(new Set([...imageRecords, ...legacyImages]));
  const fallbackImage = [
    data.image,
    data.imageUrl,
    data.imageURL,
    data.photoUrl,
    data.thumbnail,
  ].map(readImageValue).find(Boolean) || "";
  const image = allImages[0] || fallbackImage;

  return {
    ...(data as Omit<StoreProduct, "id">),
    id,
    image,
    images: allImages.length ? allImages : (image ? [image] : []),
    description: String(data.description || ""),
    features: Array.isArray(data.features) ? data.features as string[] : [],
    originalPrice: Number(data.originalPrice || data.price || 0),
    discount: Number(data.discount || 0),
    available: data.available !== false,
    minDeposit: Number(data.minDeposit || 0),
    maxInstallmentMonths: Number(data.maxInstallmentMonths || 6),
    stockCount: Number(data.stockCount ?? data.totalStock ?? 0),
    totalStock: Number(data.totalStock ?? data.stockCount ?? 0),
  };
};

const timestampValue = (value: unknown): number => {
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  return 0;
};

export const getStoreProducts = async (): Promise<StoreProduct[]> => {
  const [snapshot, imageSnapshot] = await Promise.all([
    // Do not orderBy here: legacy product documents without createdAt must remain visible.
    getDocs(productsCollection),
    getDocs(productImagesCollection),
  ]);

  const imagesByProduct = new Map<string, { position: number; dataUrl: string }[]>();
  imageSnapshot.docs.forEach((imageDoc) => {
    const data = imageDoc.data();
    const productId = String(data.productId || data.product_id || "");
    const dataUrl = readImageValue(data.dataUrl ?? data.imageData ?? data.imageUrl ?? data.url ?? data.image ?? data.src);
    if (!productId || !dataUrl) return;
    const existing = imagesByProduct.get(productId) || [];
    existing.push({ position: Number(data.position ?? 0), dataUrl });
    imagesByProduct.set(productId, existing);
  });

  return snapshot.docs
    .sort((a, b) => timestampValue(b.data().createdAt) - timestampValue(a.data().createdAt))
    .map((item) => {
      const images = (imagesByProduct.get(item.id) || [])
        .sort((a, b) => a.position - b.position)
        .map((entry) => entry.dataUrl);
      return normalizeProduct(item.id, item.data(), images);
    });
};

export const getStoreProduct = async (id: string): Promise<StoreProduct | null> => {
  const snapshot = await getDoc(doc(firestore, "products", id));
  if (!snapshot.exists()) return null;
  const imageSnapshot = await getDocs(query(
    productImagesCollection,
    where("productId", "==", id),
  ));
  const images = imageSnapshot.docs
    .sort((a, b) => Number(a.data().position ?? 0) - Number(b.data().position ?? 0))
    .map((item) => readImageValue(item.data().dataUrl ?? item.data().imageData ?? item.data().imageUrl ?? item.data().url ?? item.data().image ?? item.data().src))
    .filter(Boolean);
  return normalizeProduct(snapshot.id, snapshot.data(), images);
};

export const createStoreProduct = async (product: ProductInput): Promise<string> => {
  if (product.images.length > 4) {
    throw new Error("You can add up to 4 images per product.");
  }
  const { images, ...metadata } = product;
  const thumbnail = images[0] ? await makeThumbnail(images[0]) : "";
  const productRef = doc(productsCollection);
  const batch = writeBatch(firestore);

  // Save product metadata and all original compressed photos atomically.
  batch.set(productRef, {
    ...metadata,
    image: thumbnail,
    imageCount: images.length,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  images.forEach((dataUrl, position) => {
    batch.set(doc(productImagesCollection, `${productRef.id}_${position}`), {
      productId: productRef.id,
      position,
      dataUrl,
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
  return productRef.id;
};

export const removeStoreProduct = async (id: string): Promise<void> => {
  const imageSnapshot = await getDocs(query(productImagesCollection, where("productId", "==", id)));
  const batch = writeBatch(firestore);
  imageSnapshot.docs.forEach((imageDoc) => batch.delete(imageDoc.ref));
  batch.delete(doc(firestore, "products", id));
  await batch.commit();
};

export const updateStoreProduct = async (id: string, updates: Partial<ProductInput>): Promise<void> => {
  const { images, ...metadata } = updates;
  const productUpdates: Record<string, unknown> = {
    ...metadata,
    updatedAt: serverTimestamp(),
  };
  const productRef = doc(firestore, "products", id);

  if (images !== undefined) {
    if (images.length > 4) throw new Error("You can add up to 4 images per product.");
    productUpdates.image = images[0] ? await makeThumbnail(images[0]) : "";
    productUpdates.imageCount = images.length;
    // Remove the legacy inline array only when the administrator explicitly replaces photos.
    productUpdates.images = deleteField();

    const previous = await getDocs(query(productImagesCollection, where("productId", "==", id)));
    const batch = writeBatch(firestore);
    previous.docs.forEach((imageDoc) => batch.delete(imageDoc.ref));
    images.forEach((dataUrl, position) => {
      batch.set(doc(productImagesCollection, `${id}_${position}`), {
        productId: id,
        position,
        dataUrl,
        createdAt: serverTimestamp(),
      });
    });
    batch.update(productRef, productUpdates);
    await batch.commit();
    return;
  }

  await updateDoc(productRef, productUpdates);
};
