import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { products, formatPrice } from "@/data/products";

const Shop = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl lg:text-5xl font-display font-bold text-foreground">Our Products</h1>
            <p className="text-muted-foreground mt-2">Premium electronics for your home</p>
          </motion.div>

          <div className="grid grid-cols-2 gap-3">
            {products.map((product, index) => {
              const stockPct = Math.round((product.stockCount / product.totalStock) * 100);
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                >
                  <Link to={`/product/${product.id}`} className="group block">
                    <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100">
                      {/* Image */}
                      <div className="relative bg-gray-50 aspect-square overflow-hidden">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                          width={400}
                          height={400}
                        />
                        {/* Discount badge */}
                        {product.discount > 0 && (
                          <span className="absolute top-2 right-2 bg-[#c0160c] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                            -{product.discount}%
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-2.5">
                        <p className="text-[11px] text-gray-500 font-medium mb-0.5">{product.brand}</p>
                        <h3 className="text-[12px] font-medium text-gray-800 line-clamp-2 leading-snug mb-1.5">
                          {product.name}
                        </h3>
                        <p className="text-[14px] font-bold text-gray-900 mb-0.5">
                          {formatPrice(product.price)}
                        </p>
                        {product.originalPrice > product.price && (
                          <p className="text-[11px] text-gray-400 line-through mb-1">
                            {formatPrice(product.originalPrice)}
                          </p>
                        )}
                        <p className="text-[11px] text-gray-500 mb-1">
                          {product.stockCount} items left
                        </p>
                        {/* Stock progress bar */}
                        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${stockPct}%`,
                              background: stockPct < 30 ? "#c0160c" : stockPct < 60 ? "#f59e0b" : "#22c55e",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Shop;
