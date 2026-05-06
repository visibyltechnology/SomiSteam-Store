import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { products, formatPrice } from "@/data/products";

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.215, 0.61, 0.355, 1] as const },
  },
};

const FeaturedProducts = () => {
  return (
    <section className="py-20 lg:py-28 bg-background overflow-hidden">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="flex items-end justify-between mb-12"
        >
          <div>
            <span className="text-sm font-medium text-accent uppercase tracking-wider">Featured</span>
            <h2 className="text-3xl lg:text-4xl font-display font-bold text-foreground mt-2">
              Popular Products
            </h2>
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="h-1 w-16 bg-gradient-gold rounded-full mt-3 origin-left"
            />
          </div>
          <Link to="/shop" className="hidden sm:flex items-center gap-2 text-accent font-medium group">
            <span>View All</span>
            <motion.div animate={{ x: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
              <ArrowRight className="w-4 h-4" />
            </motion.div>
          </Link>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-2 gap-3"
        >
          {products.map((product) => {
            const stockPct = Math.round((product.stockCount / product.totalStock) * 100);
            return (
              <motion.div key={product.id} variants={cardVariants}>
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
        </motion.div>

        <div className="sm:hidden mt-8 text-center">
          <Link to="/shop">
            <Button variant="outline" className="border-accent text-accent">
              View All Products <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
