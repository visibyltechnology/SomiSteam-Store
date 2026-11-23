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
const CLOUDINARY_UPLOAD_PRESET = "Somisteam";

const getCloudinaryCloudName = (): string => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloudName) {
    throw new Error("Cloudinary is almost ready. Add VITE_CLOUDINARY_CLOUD_NAME to the Vercel Production environment variables, then redeploy.");
  }
  return cloudName;
};

const uploadToCloudinary = async (file: File): Promise<string> => {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} is not a supported image file.`);
  }

  const cloudName = getCloudinaryCloudName();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "somisteam/products");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
    { method: "POST", body: formData },
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.secure_url !== "string") {
    const message = typeof result?.error?.message === "string"
      ? result.error.message
      : "Cloudinary could not upload this photograph. Check the upload preset and cloud name.";
    throw new Error(message);
  }

  return result.secure_url;
};

// Kept under the existing export name so all admin upload flows use Cloudinary.
export const compressProductImage = async (file: File): Promise<string> => uploadToCloudinary(file);

// Import an existing product image from a public URL or data URI directly into this Cloudinary account.
// Passing a remote URL to Cloudinary avoids browser CORS restrictions on the source image host.
export const uploadProductImageSource = async (source: string): Promise<string> => {
  const isRemoteUrl = source.startsWith("https://") || source.startsWith("http://");
  const isImageDataUri = source.startsWith("data:image/");
  if (!isRemoteUrl && !isImageDataUri) {
    throw new Error("The source catalogue contains an unsupported image format.");
  }

  const cloudName = getCloudinaryCloudName();
  const formData = new FormData();
  formData.append("file", source);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "somisteam/products");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
    { method: "POST", body: formData },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.secure_url !== "string") {
    const message = typeof result?.error?.message === "string"
      ? result.error.message
      : "Cloudinary could not import a source product photograph.";
    throw new Error(message);
  }
  return result.secure_url;
};

const readImageValue = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of ["secure_url", "dataUrl", "url", "imageUrl", "downloadURL", "downloadUrl", "src", "image", "base64"]) {
    if (typeof record[key] === "string" && (record[key] as string).trim()) {
      return (record[key] as string).trim();
    }
  }
  return "";
};

const normalizeProduct = (id: string, data: Record<string, unknown>, imageRecords: string[] = []): StoreProduct => {
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
    getDocs(productsCollection),
    getDocs(productImagesCollection),
  ]);

  const imagesByProduct = new Map<string, { position: number; url: string }[]>();
  imageSnapshot.docs.forEach((imageDoc) => {
    const data = imageDoc.data();
    const productId = String(data.productId || data.product_id || "");
    const url = readImageValue(data);
    if (!productId || !url) return;
    const existing = imagesByProduct.get(productId) || [];
    existing.push({ position: Number(data.position ?? 0), url });
    imagesByProduct.set(productId, existing);
  });

  return snapshot.docs
    .sort((a, b) => timestampValue(b.data().createdAt) - timestampValue(a.data().createdAt))
    .map((item) => {
      const images = (imagesByProduct.get(item.id) || [])
        .sort((a, b) => a.position - b.position)
        .map((entry) => entry.url);
      return normalizeProduct(item.id, item.data(), images);
    });
};

export const getStoreProduct = async (id: string): Promise<StoreProduct | null> => {
  const snapshot = await getDoc(doc(firestore, "products", id));
  if (!snapshot.exists()) return null;
  const imageSnapshot = await getDocs(query(productImagesCollection, where("productId", "==", id)));
  const images = imageSnapshot.docs
    .sort((a, b) => Number(a.data().position ?? 0) - Number(b.data().position ?? 0))
    .map((item) => readImageValue(item.data()))
    .filter(Boolean);
  return normalizeProduct(snapshot.id, snapshot.data(), images);
};

export const createStoreProduct = async (product: ProductInput): Promise<string> => {
  if (product.images.length > 4) throw new Error("You can add up to 4 images per product.");
  const { images, ...metadata } = product;
  const productRef = doc(productsCollection);
  const batch = writeBatch(firestore);

  batch.set(productRef, {
    ...metadata,
    image: images[0] || "",
    imageCount: images.length,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  images.forEach((secureUrl, position) => {
    batch.set(doc(productImagesCollection, `${productRef.id}_${position}`), {
      productId: productRef.id,
      position,
      url: secureUrl,
      secure_url: secureUrl,
      provider: "cloudinary",
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
    productUpdates.image = images[0] || "";
    productUpdates.imageCount = images.length;
    productUpdates.images = deleteField();

    const previous = await getDocs(query(productImagesCollection, where("productId", "==", id)));
    const batch = writeBatch(firestore);
    previous.docs.forEach((imageDoc) => batch.delete(imageDoc.ref));
    images.forEach((secureUrl, position) => {
      batch.set(doc(productImagesCollection, `${id}_${position}`), {
        productId: id,
        position,
        url: secureUrl,
        secure_url: secureUrl,
        provider: "cloudinary",
        createdAt: serverTimestamp(),
      });
    });
    batch.update(productRef, productUpdates);
    await batch.commit();
    return;
  }

  await updateDoc(productRef, productUpdates);
};
