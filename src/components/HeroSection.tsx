import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Shield, Truck, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import tvImage from "@/assets/product-tv.jpg";
import fridgeImage from "@/assets/product-fridge.jpg";
import washerImage from "@/assets/product-washer.jpg";
import acImage from "@/assets/product-ac.jpg";

const slides = [
  { image: tvImage, label: "Smart televisions", title: "Entertainment, Elevated" },
  { image: fridgeImage, label: "Premium refrigerators", title: "Freshness That Lasts" },
  { image: washerImage, label: "Modern washing machines", title: "Everyday Care, Made Easy" },
  { image: acImage, label: "Powerful air conditioners", title: "Comfort in Every Season" },
];

const HeroSection = () => {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setActive((v) => (v + 1) % slides.length), 4500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="relative isolate min-h-[430px] md:min-h-[500px] flex items-center overflow-hidden bg-slate-950">
      <AnimatePresence mode="wait">
        <motion.div key={active} className="absolute inset-0 -z-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1 }}>
          <img src={slides[active].image} alt={slides[active].label} className="w-full h-full object-cover object-center" />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/90 via-slate-900/65 to-slate-900/20" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/45 via-transparent to-slate-950/10" />

      <div className="container mx-auto w-full px-4 lg:px-8 pt-20 pb-10 md:pt-24 md:pb-14">
        <div className="max-w-xl">
          <span className="inline-flex items-center rounded-full border border-white/25 bg-black/25 px-3 py-1.5 text-xs md:text-sm font-medium text-white mb-4">
            {slides[active].label}
          </span>
          <AnimatePresence mode="wait">
            <motion.h1 key={active} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.45 }} className="text-3xl sm:text-4xl md:text-6xl font-display font-bold leading-tight text-white mb-4">
              {slides[active].title}
            </motion.h1>
          </AnimatePresence>
          <p className="text-sm md:text-lg text-white/85 leading-relaxed max-w-lg mb-5">
            Discover quality electronics from Hisense, Samsung, LG and more. Shop with confidence or spread payments with our EasyBuy plan.
          </p>
          <div className="flex flex-wrap gap-3 mb-6">
            <Link to="/shop">
              <Button className="bg-white text-slate-900 hover:bg-gray-100 font-semibold px-6 py-4 rounded-lg shadow-lg">
                Shop Now <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link to="/easybuy">
              <Button variant="outline" className="border-white/60 text-white hover:bg-white/15 bg-black/10 px-6 py-4 rounded-lg">
                EasyBuy Plans
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-white/85 text-xs md:text-sm">
            {[{ icon: Shield, label: "Genuine Products" }, { icon: Truck, label: "Fast Delivery" }, { icon: CreditCard, label: "Flexible Payment" }].map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-2"><Icon className="w-4 h-4" />{label}</span>
            ))}
          </div>
          <div className="flex gap-2 mt-5" aria-label="Choose hero slide">
            {slides.map((slide, i) => <button key={slide.label} onClick={() => setActive(i)} aria-label={`Show ${slide.label}`} className={`h-1.5 rounded-full transition-all ${active === i ? "w-8 bg-white" : "w-3 bg-white/50"}`} />)}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
