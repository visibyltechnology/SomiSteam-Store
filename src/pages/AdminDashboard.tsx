import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Plus, Package, Users, CreditCard, TrendingUp, Trash2, LogOut,
  BarChart3, Upload, Image, Eye, Search, Filter, ChevronDown,
  DollarSign, Calendar, ShoppingBag, AlertCircle, CheckCircle,
  Clock, XCircle, Truck, ArrowUpRight, ArrowDownRight, MoreVertical,
  Settings, Pencil, Save, RefreshCw, Phone, Key, ToggleLeft, ToggleRight
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client"; // One-time legacy product import only; dashboard reads Firebase.
import { firebaseAuth } from "@/integrations/firebase/client";
import { compressProductImage, createStoreProduct, getStoreProduct, getStoreProducts, removeStoreProduct, updateStoreProduct } from "@/services/firestoreProducts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatPrice } from "@/data/products";
import { smartChoiceProducts } from "@/data/smartChoiceImport";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

interface DBProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  description: string | null;
  price: number;
  min_deposit: number;
  max_installment_months: number;
  features: string[] | null;
  images: string[] | null;
  available: boolean;
  created_at: string;
}

interface DBOrder {
  id: string;
  product_name: string;
  product_price: number;
  payment_type: string;
  total_payable: number;
  total_paid: number;
  remaining_balance: number;
  status: string;
  created_at: string;
  user_id: string;
  installment_months: number | null;
  next_payment_due: string | null;
  deposit_amount: number | null;
}

interface DBPayment {
  id: string;
  order_id: string;
  user_id: string;
  amount: number;
  status: string;
  payment_gateway: string | null;
  payment_reference: string | null;
  created_at: string;
}

interface DBProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}

type TabType = "overview" | "products" | "orders" | "payments" | "customers" | "settings";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  deposit_paid: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-purple-100 text-purple-800 border-purple-200",
  fully_paid: "bg-green-100 text-green-800 border-green-200",
  ready_for_delivery: "bg-orange-100 text-orange-800 border-orange-200",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const statusIcons: Record<string, typeof Clock> = {
  pending: Clock,
  deposit_paid: DollarSign,
  in_progress: ShoppingBag,
  fully_paid: CheckCircle,
  ready_for_delivery: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
};

const CHART_COLORS = ["hsl(0,85%,40%)", "hsl(0,80%,55%)", "hsl(0,70%,65%)", "hsl(0,60%,75%)", "hsl(0,50%,80%)", "hsl(0,40%,85%)"];

const categories = ["Televisions", "Refrigerators", "Washing Machines", "Air Conditioners", "Microwaves", "Generators"];

const AdminDashboard = () => {
  const { user, isAdmin, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [orders, setOrders] = useState<DBOrder[]>([]);
  const [payments, setPayments] = useState<DBPayment[]>([]);
  const [customers, setCustomers] = useState<DBProfile[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [migratingProducts, setMigratingProducts] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState({ done: 0, total: 0 });
  const [productImages, setProductImages] = useState<File[]>([]);
  const [editingProduct, setEditingProduct] = useState<DBProduct | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", brand: "", category: "", description: "", price: "", min_deposit: "", max_installment_months: "6", features: "" });
  const [editImages, setEditImages] = useState<File[]>([]);
  const [replaceEditImages, setReplaceEditImages] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings state
  const [flutterwaveEnabled, setFlutterwaveEnabled] = useState(true);
  const [flutterwavePublicKey, setFlutterwavePublicKey] = useState("");
  const [flutterwaveSecretKey, setFlutterwaveSecretKey] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("+234 803 331 8896");
  const [savingSettings, setSavingSettings] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  const [newProduct, setNewProduct] = useState({
    name: "", brand: "Hisense", category: "Televisions",
    description: "", price: "", min_deposit: "", max_installment_months: "6",
    features: "",
  });

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate("/login");
      return;
    }
    if (user && isAdmin) {
      fetchData();
      fetchSettings();
    }
  }, [user, isAdmin, authLoading]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const firestoreProducts = await getStoreProducts();
      setProducts(firestoreProducts.map((product) => ({
        id: product.id, name: product.name, brand: product.brand, category: product.category,
        description: product.description || null, price: product.price, min_deposit: product.minDeposit,
        max_installment_months: product.maxInstallmentMonths, features: product.features, images: product.images,
        available: product.available, created_at: product.createdAt instanceof Date ? product.createdAt.toISOString() : new Date().toISOString(),
      })));
      // Keep the dashboard usable while legacy order/payment records are migrated.
      setOrders([]);
      setPayments([]);
      setCustomers([]);
    } catch (error) {
      console.error("Firebase admin dashboard load failed:", error);
      toast.error(error instanceof Error ? error.message : "Could not load products from Firebase.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    // Do not let the retired Supabase settings endpoint block admin access.
  };

  const saveSettings = async () => {
    toast.error("Settings are not yet migrated to Firebase and have not been saved.");
  };

  const handleImageUpload = async (files: File[]): Promise<string[]> => {
    if (files.length > 4) throw new Error("You can add up to 4 images per product.");
    return Promise.all(files.map(compressProductImage));
  };

  const handleAddProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.price) {
      toast.error("Name and price are required");
      return;
    }
    setUploadingImage(true);
    try {
      const imageUrls = await handleImageUpload(productImages);
      await createStoreProduct({
        name: newProduct.name.trim(),
        brand: newProduct.brand,
        category: newProduct.category,
        description: newProduct.description || "",
        price: Number(newProduct.price),
        originalPrice: Number(newProduct.price),
        images: imageUrls,
        features: newProduct.features.split(",").map((feature) => feature.trim()).filter(Boolean),
        available: true,
        minDeposit: Number(newProduct.min_deposit) || 0,
        maxInstallmentMonths: Number(newProduct.max_installment_months) || 6,
        stockCount: 0,
        totalStock: 0,
      });
      toast.success("Product uploaded successfully!");
      setShowAddProduct(false);
      setNewProduct({ name: "", brand: "Hisense", category: "Televisions", description: "", price: "", min_deposit: "", max_installment_months: "6", features: "" });
      setProductImages([]);
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save product.");
    } finally {
      setUploadingImage(false);
    }
  };

  const importSmartChoiceProducts = async () => {
    if (!firebaseAuth.currentUser) {
      toast.error("Please sign in with the Firebase admin account first.");
      return;
    }
    setMigratingProducts(true);
    try {
      const existing = await getStoreProducts();
      const importedIds = new Set(existing.map((item) => item.legacySupabaseId).filter(Boolean));
      const pending = smartChoiceProducts.filter((item, index) => !importedIds.has("smartchoice-" + index));
      if (!pending.length) {
        toast.success("Smart Choice catalogue has already been imported.");
        return;
      }
      setMigrationProgress({ done: 0, total: pending.length });
      let completed = 0;
      for (const [index, item] of smartChoiceProducts.entries()) {
        const [name, category, sourcePrice] = item;
        const marker = "smartchoice-" + index;
        if (importedIds.has(marker)) continue;
        await createStoreProduct({
          name, brand: "Hisense", category,
          description: "Product sourced from Smart Choice Electronics Group. Price includes SomiSteam's ₦5,000 markup. Confirm current availability before purchase.",
          price: sourcePrice + 5000, originalPrice: sourcePrice + 5000, images: [], features: [],
          available: true, minDeposit: Math.round((sourcePrice + 5000) * 0.3),
          maxInstallmentMonths: 6, stockCount: 0, totalStock: 0,
          legacySupabaseId: marker,
        });
        importedIds.add(marker);
        completed += 1;
        setMigrationProgress({ done: completed, total: pending.length });
      }
      await fetchData();
      toast.success("Imported " + completed + " Smart Choice products with ₦5,000 added to each price.");
    } catch (error) {
      console.error("Smart Choice import failed:", error);
      toast.error(error instanceof Error ? error.message : "Could not import Smart Choice products.");
    } finally {
      setMigratingProducts(false);
    }
  };

  const migrateLegacyProducts = async () => {
    if (!firebaseAuth.currentUser) {
      toast.error("Sign in with the Firebase admin account first, then retry migration.");
      return;
    }
    setMigratingProducts(true);
    try {
      toast.info("Connecting to the existing product catalogue…");
      const legacyQuery = supabase.from("products").select("*").abortSignal(AbortSignal.timeout(10000));
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("The old catalogue did not respond within 10 seconds. Migration stopped safely; no source products were changed.")), 10000);
      });
      const [{ data: legacyProducts, error }, existingProducts] = await Promise.race([
        Promise.all([legacyQuery, getStoreProducts()]),
        timeout,
      ]) as [any, any];
      if (error) throw error;
      const migratedIds = new Set(existingProducts.map((product) => product.legacySupabaseId).filter(Boolean));
      const pending = (legacyProducts || []).filter((product) => !migratedIds.has(product.id));
      if (pending.length === 0) {
        toast.success("No new products to migrate. All products in the old catalogue are already migrated.");
        return;
      }
      setMigrationProgress({ done: 0, total: pending.length });
      toast.info("Found " + pending.length + " products. Starting migration…");
      let migrated = 0;
      const failures: string[] = [];

      for (const product of pending) {
        try {
          const rawImages = Array.isArray(product.images) ? product.images : (product.image ? [product.image] : product.image_url ? [product.image_url] : []);
          const sourceImages = rawImages.slice(0, 4);
          const images = await Promise.all(sourceImages.filter(Boolean).map(async (source: string, index: number) => {
            const response = await fetch(source, { signal: AbortSignal.timeout(10000), mode: "cors" });
            if (!response.ok) throw new Error("An existing product image could not be downloaded.");
            const blob = await response.blob();
            const file = new File([blob], "legacy-" + product.id + "-" + index + ".jpg", { type: blob.type || "image/jpeg" });
            return compressProductImage(file);
          }));
          await createStoreProduct({
            name: product.name,
            brand: product.brand || "Other",
            category: product.category || "Other",
            description: product.description || "",
            price: Number(product.price) || 0,
            originalPrice: Number(product.price) || 0,
            images,
            features: Array.isArray(product.features) ? product.features : [],
            available: product.available !== false,
            minDeposit: Number(product.min_deposit) || 0,
            maxInstallmentMonths: Number(product.max_installment_months) || 6,
            stockCount: 0,
            totalStock: 0,
            legacySupabaseId: product.id,
          });
          migrated += 1;
        } catch (migrationError) {
          failures.push(product.name + ": " + (migrationError instanceof Error ? migrationError.message : "migration failed"));
        } finally {
          setMigrationProgress((progress) => ({ ...progress, done: progress.done + 1 }));
        }
      }

      await fetchData();
      if (failures.length) {
        toast.warning(`Migrated ${migrated} products. ${failures.length} need attention: ${failures.slice(0, 2).join("; ")}`);
      } else {
        toast.success(migrated ? `Successfully migrated ${migrated} existing products to Firestore.` : "All existing products have already been migrated.");
      }
    } catch (migrationError) {
      console.error("Product migration failed:", migrationError);
      const message = migrationError instanceof Error ? migrationError.message : "Product migration failed."; 
      toast.error(message.includes("Timeout") || message.includes("aborted")
        ? "The old product catalogue did not respond within 20 seconds. No products were deleted. Please retry after the source connection is restored."
        : message);
    } finally {
      setMigratingProducts(false);
    }
  };

  const repairMissingProductImages = async () => {
    if (!firebaseAuth.currentUser) {
      toast.error("Sign in with the Firebase admin account first.");
      return;
    }

    setMigratingProducts(true);
    try {
      toast.info("Checking the old catalogue for the missing product photographs…");
      const [currentProducts, legacyResult] = await Promise.all([
        getStoreProducts(),
        supabase.from("products").select("*").abortSignal(AbortSignal.timeout(15000)),
      ]);
      if (legacyResult.error) throw legacyResult.error;

      const normalizeName = (value: unknown) =>
        String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const legacyByName = new Map<string, any>();
      for (const item of legacyResult.data || []) {
        const key = normalizeName(item.name);
        if (key && !legacyByName.has(key)) legacyByName.set(key, item);
      }

      const missing = currentProducts.filter((item) => !(item.images || []).some((url) => typeof url === "string" && url.trim()));
      setMigrationProgress({ done: 0, total: missing.length });
      let repaired = 0;
      const failures: string[] = [];
      let unmatched = 0;

      for (const product of missing) {
        try {
          const source = legacyByName.get(normalizeName(product.name));
          if (!source) {
            unmatched += 1;
            continue;
          }

          const rawImages = Array.isArray(source.images)
            ? source.images
            : [source.image, source.image_url, source.imageUrl].filter(Boolean);
          const sourceUrls = rawImages.map((value: unknown) => {
            if (typeof value === "string") return value.trim();
            if (!value || typeof value !== "object") return "";
            const record = value as Record<string, unknown>;
            return [record.secure_url, record.url, record.imageUrl, record.src]
              .find((entry) => typeof entry === "string" && entry.trim()) as string || "";
          }).filter((url: string) => /^https?:\/\//i.test(url)).slice(0, 4);

          if (!sourceUrls.length) {
            unmatched += 1;
            continue;
          }

          const cloudinaryUrls = await Promise.all(sourceUrls.map(async (sourceUrl: string, index: number) => {
            const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(15000), mode: "cors" });
            if (!response.ok) throw new Error("The source photograph could not be downloaded.");
            const blob = await response.blob();
            const file = new File([blob], "recovered-" + product.id + "-" + index + ".jpg", { type: blob.type || "image/jpeg" });
            return compressProductImage(file);
          }));

          await updateStoreProduct(product.id, { images: cloudinaryUrls });
          repaired += 1;
        } catch (error) {
          failures.push(product.name + ": " + (error instanceof Error ? error.message : "image recovery failed"));
        } finally {
          setMigrationProgress((progress) => ({ ...progress, done: progress.done + 1 }));
        }
      }

      await fetchData();
      if (repaired) {
        toast.success("Recovered and saved Cloudinary photos for " + repaired + " products.");
      } else {
        toast.warning("No missing photos could be recovered from the old catalogue. " + unmatched + " products had no exact image match.");
      }
      if (failures.length) {
        toast.error(failures.length + " products still need image attention: " + failures.slice(0, 2).join("; "));
      }
    } catch (error) {
      console.error("Missing product image repair failed:", error);
      toast.error(error instanceof Error ? error.message : "Could not repair missing product images.");
    } finally {
      setMigratingProducts(false);
    }
  };

  const openProductEditor = async (product: DBProduct) => {
    try {
      const full = await getStoreProduct(product.id);
      if (!full) throw new Error("Product could not be found.");
      setEditingProduct(product);
      setEditDraft({
        name: full.name, brand: full.brand, category: full.category, description: full.description || "",
        price: String(full.price), min_deposit: String(full.minDeposit || 0),
        max_installment_months: String(full.maxInstallmentMonths || 6), features: (full.features || []).join(", "),
      });
      setEditImages([]);
      setReplaceEditImages(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open product editor.");
    }
  };

  const saveProductEdits = async () => {
    if (!editingProduct || !editDraft.name.trim() || !editDraft.price) return;
    setUploadingImage(true);
    try {
      const updates: any = {
        name: editDraft.name.trim(), brand: editDraft.brand, category: editDraft.category,
        description: editDraft.description, price: Number(editDraft.price), originalPrice: Number(editDraft.price),
        minDeposit: Number(editDraft.min_deposit) || 0,
        maxInstallmentMonths: Number(editDraft.max_installment_months) || 6,
        features: editDraft.features.split(",").map((item) => item.trim()).filter(Boolean),
      };
      if (replaceEditImages) updates.images = await handleImageUpload(editImages);
      await updateStoreProduct(editingProduct.id, updates);
      toast.success("Product updated successfully!");
      setEditingProduct(null); setEditImages([]); setReplaceEditImages(false);
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update product.");
    } finally {
      setUploadingImage(false);
    }
  };
  const handleDeleteProduct = async (id: string) => {
    try {
      await removeStoreProduct(id);
      toast.success("Product deleted");
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete product.");
    }
  };

  const handleUpdateOrderStatus = async (_orderId: string, _status: string) => {
    toast.error("Order management will be enabled after order records are migrated to Firebase.");
  };

  const totalRevenue = orders.reduce((sum, o) => sum + o.total_paid, 0);
  const pendingPayments = orders.reduce((sum, o) => sum + o.remaining_balance, 0);
  const completedOrders = orders.filter(o => o.status === "delivered").length;
  const activeOrders = orders.filter(o => !["delivered", "cancelled"].includes(o.status)).length;

  const ordersByStatus = Object.entries(
    orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  const productsByCategory = Object.entries(
    products.reduce((acc, p) => { acc[p.category] = (acc[p.category] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const revenueByMonth = orders.reduce((acc, o) => {
    const month = new Date(o.created_at).toLocaleDateString("en", { month: "short", year: "2-digit" });
    const existing = acc.find(a => a.month === month);
    if (existing) { existing.revenue += o.total_paid; existing.orders += 1; }
    else acc.push({ month, revenue: o.total_paid, orders: 1 });
    return acc;
  }, [] as { month: string; revenue: number; orders: number }[]);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOrders = orders.filter(o =>
    o.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPayments = payments.filter(p =>
    p.payment_reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.payment_gateway?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomers = customers.filter(c =>
    c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: typeof BarChart3 }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "products", label: "Products", icon: Package },
    { id: "orders", label: "Orders", icon: ShoppingBag },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "customers", label: "Customers", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-gold flex items-center justify-center">
                <Package className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-display font-bold text-foreground">SomiSteam Admin</h1>
                <p className="text-[10px] text-muted-foreground">Management Console</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4 mr-1" /> Logout
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide -mb-px">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setActiveTab(id); setSearchQuery(""); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === id
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {id === "orders" && activeOrders > 0 && (
                  <span className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-full">{activeOrders}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 lg:px-8 py-6">
        <AnimatePresence mode="wait">

          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {[
                  { icon: DollarSign, label: "Total Revenue", value: formatPrice(totalRevenue), trend: "+12%", up: true, color: "bg-green-50 text-green-600" },
                  { icon: Clock, label: "Pending Balance", value: formatPrice(pendingPayments), trend: `${activeOrders} active`, up: false, color: "bg-orange-50 text-orange-600" },
                  { icon: ShoppingBag, label: "Total Orders", value: orders.length.toString(), trend: `${completedOrders} delivered`, up: true, color: "bg-blue-50 text-blue-600" },
                  { icon: Users, label: "Customers", value: customers.length.toString(), trend: `${products.length} products`, up: true, color: "bg-purple-50 text-purple-600" },
                ].map(({ icon: Icon, label, value, trend, up, color }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-card rounded-2xl p-4 shadow-sm border border-border/50"
                  >
                    <div className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center mb-3`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
                    <p className="text-lg font-display font-bold text-foreground">{value}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {up ? <ArrowUpRight className="w-3 h-3 text-green-500" /> : <ArrowDownRight className="w-3 h-3 text-orange-500" />}
                      <span className="text-[10px] text-muted-foreground">{trend}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
                  <h3 className="text-sm font-display font-semibold text-foreground mb-4">Revenue Trend</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,10%,91%)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(0,5%,46%)" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(0,5%,46%)" />
                      <Tooltip formatter={(v: number) => formatPrice(v)} />
                      <Line type="monotone" dataKey="revenue" stroke="hsl(0,85%,40%)" strokeWidth={2} dot={{ fill: "hsl(0,85%,40%)" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
                  <h3 className="text-sm font-display font-semibold text-foreground mb-4">Orders by Status</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={ordersByStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={{ stroke: "hsl(0,5%,46%)" }}>
                        {ordersByStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/50">
                <h3 className="text-sm font-display font-semibold text-foreground mb-4">Products by Category</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={productsByCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,10%,91%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="hsl(0,5%,46%)" angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(0,5%,46%)" />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(0,85%,40%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6 bg-card rounded-2xl p-5 shadow-sm border border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-display font-semibold text-foreground">Recent Orders</h3>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("orders")} className="text-xs text-accent">
                    View all <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {orders.slice(0, 5).map((order) => {
                    const StatusIcon = statusIcons[order.status] || Clock;
                    return (
                      <div key={order.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusColors[order.status] || "bg-muted"}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-foreground">{order.product_name}</p>
                            <p className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-foreground">{formatPrice(order.total_payable)}</p>
                          <Badge variant="outline" className={`text-[9px] ${statusColors[order.status]}`}>
                            {order.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                  {orders.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">No orders yet</p>}
                </div>
              </div>
            </motion.div>
          )}

          {/* PRODUCTS TAB */}
          {activeTab === "products" && (
            <motion.div key="products" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 rounded-xl" />
                </div>
                <Button variant="outline" onClick={importSmartChoiceProducts} disabled={migratingProducts} className="rounded-xl">\n                  <Plus className="mr-2 w-4 h-4" /> Import Smart Choice + ₦5,000\n                </Button>\n                <Button variant="outline" onClick={repairMissingProductImages} disabled={migratingProducts} className="rounded-xl">
                  <Image className={`mr-2 w-4 h-4 ${migratingProducts ? "animate-pulse" : ""}`} />
                  {migratingProducts ? "Checking images…" : "Repair Missing Images"}
                </Button>
                <Button variant="outline" onClick={migrateLegacyProducts} disabled={migratingProducts} className="rounded-xl">
                  <RefreshCw className={`mr-2 w-4 h-4 ${migratingProducts ? "animate-spin" : ""}`} />
                  {migratingProducts ? (migrationProgress.total ? "Migrating " + migrationProgress.done + "/" + migrationProgress.total : "Connecting to old catalogue...") : "Migrate Existing Products"}
                </Button>
                <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-gold text-accent-foreground rounded-xl shadow-gold">
                      <Plus className="mr-2 w-4 h-4" /> Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="font-display">Add New Product</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1 block">Product Name</label>
                        <Input value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} placeholder='Hisense 55" 4K Smart TV' className="rounded-xl" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1 block">Brand</label>
                          <Input value={newProduct.brand} onChange={e => setNewProduct({ ...newProduct, brand: e.target.value })} className="rounded-xl" />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1 block">Category</label>
                          <Select value={newProduct.category} onValueChange={v => setNewProduct({ ...newProduct, category: v })}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
                        <Textarea value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} className="rounded-xl" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1 block">Price (₦)</label>
                          <Input type="number" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} className="rounded-xl" />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1 block">Min Deposit (₦)</label>
                          <Input type="number" value={newProduct.min_deposit} onChange={e => setNewProduct({ ...newProduct, min_deposit: e.target.value })} className="rounded-xl" />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1 block">Max Installment Months</label>
                        <Input type="number" value={newProduct.max_installment_months} onChange={e => setNewProduct({ ...newProduct, max_installment_months: e.target.value })} className="rounded-xl" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1 block">Features (comma separated)</label>
                        <Input value={newProduct.features} onChange={e => setNewProduct({ ...newProduct, features: e.target.value })} placeholder="4K UHD, Smart TV, HDR" className="rounded-xl" />
                      </div>

                      {/* Image Upload */}
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1 block">Product Images</label>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            if (e.target.files) {
                              const selected = Array.from(e.target.files);
                              setProductImages((previous) => {
                                const combined = [...previous, ...selected];
                                if (combined.length > 4) {
                                  toast.error("You can upload a maximum of 4 photos per product.");
                                  return combined.slice(0, 4);
                                }
                                return combined;
                              });
                              e.currentTarget.value = "";
                            }
                          }}
                        />
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-accent transition-colors"
                        >
                          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload images</p>
                          <p className="text-[10px] text-muted-foreground mt-1">Select up to 4 photos. You can add photos in multiple selections.</p>
                        </div>
                        {productImages.length > 0 && (
                          <div className="flex gap-2 mt-3 flex-wrap">
                            {productImages.map((file, i) => (
                              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                                <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                                <button
                                  onClick={(e) => { e.stopPropagation(); setProductImages(productImages.filter((_, j) => j !== i)); }}
                                  className="absolute top-0.5 right-0.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                                >
                                  <XCircle className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <Button onClick={handleAddProduct} disabled={uploadingImage} className="w-full bg-gradient-gold text-accent-foreground rounded-xl shadow-gold">
                        {uploadingImage ? "Uploading..." : "Add Product"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Dialog open={!!editingProduct} onOpenChange={(open) => { if (!open) { setEditingProduct(null); setEditImages([]); setReplaceEditImages(false); } }}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle className="font-display">Edit Product</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div><label className="text-sm font-medium mb-1 block">Product Name</label><Input value={editDraft.name} onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-sm font-medium mb-1 block">Brand</label><Input value={editDraft.brand} onChange={e => setEditDraft({ ...editDraft, brand: e.target.value })} /></div>
                      <div><label className="text-sm font-medium mb-1 block">Category</label><Select value={editDraft.category} onValueChange={v => setEditDraft({ ...editDraft, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                    <div><label className="text-sm font-medium mb-1 block">Description</label><Textarea value={editDraft.description} onChange={e => setEditDraft({ ...editDraft, description: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-sm font-medium mb-1 block">Price (₦)</label><Input type="number" value={editDraft.price} onChange={e => setEditDraft({ ...editDraft, price: e.target.value })} /></div>
                      <div><label className="text-sm font-medium mb-1 block">Minimum Deposit (₦)</label><Input type="number" value={editDraft.min_deposit} onChange={e => setEditDraft({ ...editDraft, min_deposit: e.target.value })} /></div>
                    </div>
                    <div><label className="text-sm font-medium mb-1 block">Maximum Installment Months</label><Input type="number" value={editDraft.max_installment_months} onChange={e => setEditDraft({ ...editDraft, max_installment_months: e.target.value })} /></div>
                    <div><label className="text-sm font-medium mb-1 block">Features (comma separated)</label><Input value={editDraft.features} onChange={e => setEditDraft({ ...editDraft, features: e.target.value })} /></div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Replace Product Photos (optional)</label>
                      <input ref={editFileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { const selected = Array.from(e.target.files || []); if (selected.length > 4) { toast.error("Choose up to 4 photos."); return; } setEditImages(selected); setReplaceEditImages(true); e.currentTarget.value = ""; }} />
                      <Button type="button" variant="outline" className="w-full" onClick={() => editFileInputRef.current?.click()}><Upload className="w-4 h-4 mr-2" />Choose replacement photos</Button>
                      {replaceEditImages && <p className="text-xs text-muted-foreground mt-2">{editImages.length} replacement photo(s) selected. Saving replaces the current photos.</p>}
                    </div>
                    <Button className="w-full" disabled={uploadingImage || !editDraft.name.trim() || !editDraft.price} onClick={saveProductEdits}>{uploadingImage ? "Saving changes..." : "Save Changes"}</Button>
                  </div>
                </DialogContent>
              </Dialog>
              <div className="text-xs text-muted-foreground mb-3">{filteredProducts.length} products</div>

              <div className="space-y-2">
                {filteredProducts.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-card rounded-xl p-3 shadow-sm border border-border/50 flex items-center gap-3"
                  >
                    <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
                      {product.images && product.images[0] ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Image className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-semibold text-foreground truncate">{product.name}</h3>
                      <p className="text-[10px] text-muted-foreground">{product.brand} • {product.category}</p>
                      <p className="text-xs font-bold text-accent mt-0.5">{formatPrice(product.price)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className={product.available ? "text-green-600 border-green-200 bg-green-50 text-[10px]" : "text-red-600 border-red-200 bg-red-50 text-[10px]"}>
                        {product.available ? "Active" : "Inactive"}
                      </Badge>
                      <Button size="icon" variant="ghost" onClick={() => openProductEditor(product)} className="text-accent w-8 h-8" aria-label="Edit product">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteProduct(product.id)} className="text-destructive w-7 h-7">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    <Package className="w-10 h-10 mx-auto mb-2 text-border" />
                    No products found
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ORDERS TAB */}
          {activeTab === "orders" && (
            <motion.div key="orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search orders..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 rounded-xl" />
              </div>

              <div className="text-xs text-muted-foreground mb-3">{filteredOrders.length} orders</div>

              <div className="space-y-2">
                {filteredOrders.map((order, i) => {
                  const StatusIcon = statusIcons[order.status] || Clock;
                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="bg-card rounded-xl p-4 shadow-sm border border-border/50"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusColors[order.status]}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h3 className="text-xs font-semibold text-foreground">{order.product_name}</h3>
                            <p className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleDateString()} • {order.payment_type.replace(/_/g, " ")}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-secondary/50 rounded-lg p-2">
                          <p className="text-[9px] text-muted-foreground">Total</p>
                          <p className="text-[11px] font-bold text-foreground">{formatPrice(order.total_payable)}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-2">
                          <p className="text-[9px] text-muted-foreground">Paid</p>
                          <p className="text-[11px] font-bold text-green-600">{formatPrice(order.total_paid)}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-2">
                          <p className="text-[9px] text-muted-foreground">Balance</p>
                          <p className="text-[11px] font-bold text-orange-600">{formatPrice(order.remaining_balance)}</p>
                        </div>
                      </div>

                      <div className="w-full bg-secondary rounded-full h-1.5 mb-3">
                        <div
                          className="bg-accent rounded-full h-1.5 transition-all"
                          style={{ width: `${order.total_payable > 0 ? Math.min((order.total_paid / order.total_payable) * 100, 100) : 0}%` }}
                        />
                      </div>

                      <Select value={order.status} onValueChange={v => handleUpdateOrderStatus(order.id, v)}>
                        <SelectTrigger className="w-full rounded-xl text-xs h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["pending", "deposit_paid", "in_progress", "fully_paid", "ready_for_delivery", "delivered", "cancelled"].map(s => (
                            <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </motion.div>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-border" />
                    No orders found
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* PAYMENTS TAB */}
          {activeTab === "payments" && (
            <motion.div key="payments" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search payments..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 rounded-xl" />
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-card rounded-xl p-3 shadow-sm border border-border/50 text-center">
                  <p className="text-[10px] text-muted-foreground">Total</p>
                  <p className="text-sm font-bold text-foreground">{payments.length}</p>
                </div>
                <div className="bg-card rounded-xl p-3 shadow-sm border border-border/50 text-center">
                  <p className="text-[10px] text-muted-foreground">Successful</p>
                  <p className="text-sm font-bold text-green-600">{payments.filter(p => p.status === "success").length}</p>
                </div>
                <div className="bg-card rounded-xl p-3 shadow-sm border border-border/50 text-center">
                  <p className="text-[10px] text-muted-foreground">Pending</p>
                  <p className="text-sm font-bold text-orange-600">{payments.filter(p => p.status === "pending").length}</p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground mb-3">{filteredPayments.length} payments</div>

              <div className="space-y-2">
                {filteredPayments.map((payment, i) => (
                  <motion.div
                    key={payment.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-card rounded-xl p-3 shadow-sm border border-border/50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          payment.status === "success" ? "bg-green-50 text-green-600" :
                          payment.status === "pending" ? "bg-yellow-50 text-yellow-600" :
                          "bg-red-50 text-red-600"
                        }`}>
                          {payment.status === "success" ? <CheckCircle className="w-4 h-4" /> :
                           payment.status === "pending" ? <Clock className="w-4 h-4" /> :
                           <XCircle className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{formatPrice(payment.amount)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {payment.payment_gateway || "N/A"} • {new Date(payment.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={`text-[9px] ${
                          payment.status === "success" ? "text-green-600 border-green-200 bg-green-50" :
                          payment.status === "pending" ? "text-yellow-600 border-yellow-200 bg-yellow-50" :
                          "text-red-600 border-red-200 bg-red-50"
                        }`}>
                          {payment.status}
                        </Badge>
                        {payment.payment_reference && (
                          <p className="text-[9px] text-muted-foreground mt-1 truncate max-w-[100px]">{payment.payment_reference}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {filteredPayments.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    <CreditCard className="w-10 h-10 mx-auto mb-2 text-border" />
                    No payments found
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* CUSTOMERS TAB */}
          {activeTab === "customers" && (
            <motion.div key="customers" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search customers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 rounded-xl" />
              </div>

              <div className="text-xs text-muted-foreground mb-3">{filteredCustomers.length} customers</div>

              <div className="space-y-2">
                {filteredCustomers.map((customer, i) => {
                  const customerOrders = orders.filter(o => o.user_id === customer.user_id);
                  const totalSpent = customerOrders.reduce((s, o) => s + o.total_paid, 0);
                  return (
                    <motion.div
                      key={customer.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="bg-card rounded-xl p-4 shadow-sm border border-border/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-accent">
                            {(customer.full_name || "?")[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs font-semibold text-foreground">{customer.full_name || "Unknown"}</h3>
                          <p className="text-[10px] text-muted-foreground">
                            {customer.phone || "No phone"} • Joined {new Date(customer.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-bold text-foreground">{formatPrice(totalSpent)}</p>
                          <p className="text-[10px] text-muted-foreground">{customerOrders.length} orders</p>
                        </div>
                      </div>
                      {customer.address && (
                        <p className="text-[10px] text-muted-foreground mt-2 pl-[52px]">Lagos, Nigeria — {customer.address}</p>
                      )}
                    </motion.div>
                  );
                })}
                {filteredCustomers.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    <Users className="w-10 h-10 mx-auto mb-2 text-border" />
                    No customers found
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === "settings" && (
            <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5 max-w-2xl">

              {/* Flutterwave Section */}
              <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-sm font-display font-bold text-foreground">Flutterwave Payment</h3>
                      <p className="text-[11px] text-muted-foreground">Manage your payment gateway keys</p>
                    </div>
                  </div>
                  {/* ON / OFF Toggle */}
                  <button
                    onClick={() => setFlutterwaveEnabled(!flutterwaveEnabled)}
                    className="flex items-center gap-2 focus:outline-none"
                    aria-label="Toggle Flutterwave"
                  >
                    <span className={`text-xs font-semibold ${flutterwaveEnabled ? "text-green-600" : "text-muted-foreground"}`}>
                      {flutterwaveEnabled ? "ON" : "OFF"}
                    </span>
                    <div className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${flutterwaveEnabled ? "bg-green-500" : "bg-muted-foreground/30"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${flutterwaveEnabled ? "translate-x-6" : "translate-x-0"}`} />
                    </div>
                  </button>
                </div>

                <div className={`px-5 py-5 space-y-4 transition-opacity ${flutterwaveEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Public Key</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={flutterwavePublicKey}
                        onChange={e => setFlutterwavePublicKey(e.target.value)}
                        placeholder="FLWPUBK-..."
                        className="pl-9 rounded-xl font-mono text-xs"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Used in the frontend checkout. Starts with FLWPUBK-</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Secret Key</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={flutterwaveSecretKey}
                        onChange={e => setFlutterwaveSecretKey(e.target.value)}
                        type={showSecretKey ? "text" : "password"}
                        placeholder="FLWSECK-..."
                        className="pl-9 pr-16 rounded-xl font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecretKey(!showSecretKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-accent hover:underline"
                      >
                        {showSecretKey ? "Hide" : "Show"}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Used server-side only. Keep this secret. Starts with FLWSECK-</p>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="text-[11px] text-amber-800 font-medium">After updating keys here, also update them in your Supabase edge function secrets for live payment processing.</p>
                  </div>
                </div>
              </div>

              {/* WhatsApp Section */}
              <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border/50 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-display font-bold text-foreground">WhatsApp Chat Button</h3>
                    <p className="text-[11px] text-muted-foreground">Number customers tap to chat with you</p>
                  </div>
                </div>
                <div className="px-5 py-5">
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">WhatsApp Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={whatsappNumber}
                      onChange={e => setWhatsappNumber(e.target.value)}
                      placeholder="+234 803 331 8896"
                      className="pl-9 rounded-xl"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Include country code (e.g. +234 803 331 8896). The chat button on the site will use this number.</p>
                </div>
              </div>

              {/* Save Button */}
              <Button
                onClick={saveSettings}
                disabled={savingSettings}
                className="w-full bg-gradient-gold text-accent-foreground rounded-xl shadow-gold h-11 text-sm font-semibold"
              >
                {savingSettings ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Save Settings</>
                )}
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminDashboard;
