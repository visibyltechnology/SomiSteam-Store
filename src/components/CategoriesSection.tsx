import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { categories } from "@/data/products";
import { useStoreProducts } from "@/hooks/useStoreProducts";
import tvImage from "@/assets/product-tv.jpg";
import fridgeImage from "@/assets/product-fridge.jpg";
import washerImage from "@/assets/product-washer.jpg";
import acImage from "@/assets/product-ac.jpg";

const fallbackImages: Record<string, string> = {
  Televisions: tvImage,
  Refrigerators: fridgeImage,
  "Washing Machines": washerImage,
  "Air Conditioners": acImage,
};

const CategoriesSection = () => {
  const { products } = useStoreProducts();
  return (
    <section className="py-10 md:py-14 bg-slate-50 overflow-hidden">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="text-center mb-7 md:mb-9">
          <span className="text-xs font-semibold text-accent uppercase tracking-widest">Browse</span>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mt-1">Shop by Category</h2>
          <div className="h-1 w-16 bg-accent rounded-full mx-auto mt-3" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((cat, index) => {
            const actualImage = products.find((product) => product.category === cat.name && product.image)?.image || fallbackImages[cat.name];
            return (
              <motion.div key={cat.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }}>
                <Link to={`/shop?category=${encodeURIComponent(cat.name)}`} className="group relative flex min-h-[132px] md:min-h-[150px] items-end overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  {actualImage && <img src={actualImage} alt={cat.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />
                  <div className="relative z-10 p-3 text-left">
                    <h3 className="text-sm md:text-base font-semibold text-white drop-shadow">{cat.name}</h3>
                    <p className="text-[11px] md:text-xs text-white/80 mt-0.5">{cat.count} products</p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategoriesSection;
