import { motion, AnimatePresence } from "framer-motion";
  import { Link } from "react-router-dom";
  import { useState, useMemo } from "react";
  import { Search, X } from "lucide-react";
  import Navbar from "@/components/Navbar";
  import Footer from "@/components/Footer";
  import { products, formatPrice } from "@/data/products";

  const ALL = "All";
  const categories = [ALL, "Televisions", "Refrigerators", "Washing Machines", "Air Conditioners"];
  const brands = [ALL, "Hisense", "Samsung"];

  const Shop = () => {
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState(ALL);
    const [activeBrand, setActiveBrand] = useState(ALL);

    const filtered = useMemo(() => {
      return products.filter((p) => {
        const matchQuery =
          query.trim() === "" ||
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.brand.toLowerCase().includes(query.toLowerCase());
        const matchCat = activeCategory === ALL || p.category === activeCategory;
        const matchBrand = activeBrand === ALL || p.brand === activeBrand;
        return matchQuery && matchCat && matchBrand;
      });
    }, [query, activeCategory, activeBrand]);

    const clearFilters = () => {
      setQuery("");
      setActiveCategory(ALL);
      setActiveBrand(ALL);
    };

    const hasFilters = query.trim() || activeCategory !== ALL || activeBrand !== ALL;

    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="pt-24 pb-16">
          <div className="container mx-auto px-4 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <h1 className="text-3xl lg:text-5xl font-display font-bold text-foreground">Our Products</h1>
              <p className="text-muted-foreground mt-2">Premium electronics for your home</p>
            </motion.div>

            {/* Search Bar */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative mb-4"
            >
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or brand…"
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </motion.div>

            {/* Category Filter */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-3 overflow-x-auto pb-1"
            >
              <div className="flex gap-2 min-w-max">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                      activeCategory === cat
                        ? "bg-accent text-white shadow-sm"
                        : "bg-secondary text-foreground hover:bg-accent/10"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Brand Filter */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-5 flex items-center gap-2"
            >
              <span className="text-xs text-muted-foreground">Brand:</span>
              <div className="flex gap-2">
                {brands.map((brand) => (
                  <button
                    key={brand}
                    onClick={() => setActiveBrand(brand)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      activeBrand === brand
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-muted-foreground hover:border-accent/50"
                    }`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </motion.div>

            {/* Results count */}
            {hasFilters && (
              <p className="text-xs text-muted-foreground mb-4">
                {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              </p>
            )}

            {/* Product Grid */}
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-16"
                >
                  <p className="text-muted-foreground text-sm">No products match your search.</p>
                  <button onClick={clearFilters} className="mt-3 text-accent text-sm underline">
                    Clear filters
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="grid"
                  className="grid grid-cols-2 gap-3"
                  layout
                >
                  {filtered.map((product, index) => (
                    <motion.div
                      key={product.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.04 }}
                    >
                      <Link to={`/product/${product.id}`} className="group block">
                        <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100">
                          <div className="relative bg-gray-50 aspect-square overflow-hidden">
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                              width={400}
                              height={400}
                            />
                            {product.discount > 0 && (
                              <span className="absolute top-2 right-2 bg-[#c0160c] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                -{product.discount}%
                              </span>
                            )}
                          </div>
                          <div className="p-2.5">
                            <p className="text-[11px] text-gray-500 font-medium mb-0.5">{product.brand}</p>
                            <h3 className="text-[12px] font-medium text-gray-800 line-clamp-2 leading-snug mb-1.5">
                              {product.name}
                            </h3>
                            <p className="text-[14px] font-bold text-gray-900 mb-0.5">
                              {formatPrice(product.price)}
                            </p>
                            {product.originalPrice > product.price && (
                              <p className="text-[11px] text-gray-400 line-through">
                                {formatPrice(product.originalPrice)}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <Footer />
      </div>
    );
  };

  export default Shop;
  