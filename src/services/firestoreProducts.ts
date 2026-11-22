import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  setDoc,
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

const normalizeProduct = (id: string, data: Record<string, unknown>, images: string[] = []): StoreProduct => {
  const thumbnail = String(data.image || images[0] || "");
  return {
    ...(data as Omit<StoreProduct, "id">),
    id,
    image: thumbnail,
    images: images.length ? images : (thumbnail ? [thumbnail] : []),
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

export const getStoreProducts = async (): Promise<StoreProduct[]> => {
  const snapshot = await getDocs(query(productsCollection, orderBy("createdAt", "desc")));
  return snapshot.docs.map((item) => normalizeProduct(item.id, item.data()));
};

export const getStoreProduct = async (id: string): Promise<StoreProduct | null> => {
  const snapshot = await getDoc(doc(firestore, "products", id));
  if (!snapshot.exists()) return null;
  // Sort locally so this lookup does not require a composite Firestore index.
  const imageSnapshot = await getDocs(query(
    productImagesCollection,
    where("productId", "==", id),
  ));
  const images = imageSnapshot.docs
    .sort((a, b) => Number(a.data().position ?? 0) - Number(b.data().position ?? 0))
    .map((item) => String(item.data().dataUrl || ""))
    .filter(Boolean);
  return normalizeProduct(snapshot.id, snapshot.data(), images);
};

export const createStoreProduct = async (product: ProductInput): Promise<string> => {
  if (product.images.length > 4) {
    throw new Error("You can add up to 4 images per product.");
  }
  const { images, ...metadata } = product;
  const thumbnail = images[0] ? await makeThumbnail(images[0]) : "";
  const result = await addDoc(productsCollection, {
    ...metadata,
    image: thumbnail,
    imageCount: images.length,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await Promise.all(images.map((dataUrl, position) =>
      setDoc(doc(firestore, "productImages", `${result.id}_${position}`), {
        productId: result.id,
        position,
        dataUrl,
        createdAt: serverTimestamp(),
      }),
    ));
  } catch (error) {
    await deleteDoc(result);
    throw error;
  }
  return result.id;
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
  if (images) {
    productUpdates.image = images[0] ? await makeThumbnail(images[0]) : "";
    productUpdates.imageCount = images.length;
    const previous = await getDocs(query(productImagesCollection, where("productId", "==", id)));
    const batch = writeBatch(firestore);
    previous.docs.forEach((imageDoc) => batch.delete(imageDoc.ref));
    images.forEach((dataUrl, position) => {
      batch.set(doc(firestore, "productImages", `${id}_${position}`), {
        productId: id,
        position,
        dataUrl,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
  await updateDoc(doc(firestore, "products", id), productUpdates);
};
