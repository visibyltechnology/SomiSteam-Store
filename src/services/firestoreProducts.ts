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
}

type ProductInput = Omit<StoreProduct, "id" | "image" | "discount"> & {
  images: string[];
};

const productsCollection = collection(firestore, "products");

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

export const getStoreProducts = async (): Promise<StoreProduct[]> => {
  const snapshot = await getDocs(query(productsCollection, orderBy("createdAt", "desc")));
  return snapshot.docs.map((item) => {
    const data = item.data() as Omit<StoreProduct, "id">;
    const images = Array.isArray(data.images) ? data.images : [];
    return {
      ...data,
      id: item.id,
      images,
      image: images[0] || data.image || "",
      description: data.description || "",
      features: data.features || [],
      originalPrice: Number(data.originalPrice || data.price || 0),
      discount: Number(data.discount || 0),
      available: data.available !== false,
      minDeposit: Number(data.minDeposit || 0),
      maxInstallmentMonths: Number(data.maxInstallmentMonths || 6),
      stockCount: Number(data.stockCount ?? data.totalStock ?? 0),
      totalStock: Number(data.totalStock ?? data.stockCount ?? 0),
    };
  });
};

export const getStoreProduct = async (id: string): Promise<StoreProduct | null> => {
  const snapshot = await getDoc(doc(firestore, "products", id));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Omit<StoreProduct, "id">;
  const images = Array.isArray(data.images) ? data.images : [];
  return {
    ...data,
    id: snapshot.id,
    images,
    image: images[0] || data.image || "",
    description: data.description || "",
    features: data.features || [],
    originalPrice: Number(data.originalPrice || data.price || 0),
    discount: Number(data.discount || 0),
    available: data.available !== false,
    minDeposit: Number(data.minDeposit || 0),
    maxInstallmentMonths: Number(data.maxInstallmentMonths || 6),
    stockCount: Number(data.stockCount ?? data.totalStock ?? 0),
    totalStock: Number(data.totalStock ?? data.stockCount ?? 0),
  };
};

export const createStoreProduct = async (product: ProductInput): Promise<string> => {
  const estimatedBytes = product.images.reduce((sum, image) => sum + image.length, 0);
  if (estimatedBytes > 800_000) {
    throw new Error("The combined product images are too large for one Firestore document. Use fewer or smaller images.");
  }
  const { image: _unusedImage, ...payload } = product as ProductInput & { image?: string };
  const result = await addDoc(productsCollection, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return result.id;
};

export const removeStoreProduct = async (id: string): Promise<void> => {
  await deleteDoc(doc(firestore, "products", id));
};

export const updateStoreProduct = async (id: string, updates: Partial<ProductInput>): Promise<void> => {
  await updateDoc(doc(firestore, "products", id), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};
