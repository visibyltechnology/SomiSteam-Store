import { useEffect, useState } from "react";
import { getStoreProducts, StoreProduct } from "@/services/firestoreProducts";

export const useStoreProducts = () => {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getStoreProducts()
      .then((items) => { if (active) setProducts(items.filter((item) => item.available)); })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load products.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { products, loading, error };
};
