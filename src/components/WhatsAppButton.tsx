import { motion } from "framer-motion";

const WHATSAPP_NUMBER = "2348033318896";
const WHATSAPP_MESSAGE = "Hello SomiSteam! I'd like to enquire about your products.";

const WhatsAppButton = () => {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#25D366] text-white rounded-full shadow-lg hover:shadow-xl transition-shadow"
      style={{ padding: "12px 20px 12px 16px" }}
      aria-label="Chat with us on WhatsApp"
    >
      <svg
        viewBox="0 0 32 32"
        className="w-6 h-6 flex-shrink-0"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M16.003 2.667C8.636 2.667 2.667 8.636 2.667 16.003c0 2.37.638 4.69 1.847 6.72L2.667 29.333l6.82-1.79a13.29 13.29 0 0 0 6.516 1.69c7.367 0 13.336-5.97 13.336-13.23 0-7.367-5.97-13.336-13.336-13.336zm0 24.24a11.07 11.07 0 0 1-5.656-1.547l-.405-.24-4.047 1.063 1.08-3.943-.265-.418A11.04 11.04 0 0 1 4.99 16.003c0-6.075 4.938-11.013 11.013-11.013S27.016 9.928 27.016 16.003c0 6.076-4.938 11.014-11.013 11.014v-.11zm6.046-8.25c-.33-.165-1.96-.968-2.263-1.077-.304-.11-.524-.165-.745.165-.22.33-.857 1.077-1.05 1.297-.193.22-.386.248-.716.083-.33-.165-1.395-.514-2.657-1.64-.982-.876-1.645-1.957-1.838-2.287-.193-.33-.02-.51.145-.674.15-.148.33-.387.496-.58.166-.193.22-.33.33-.55.11-.22.055-.413-.028-.58-.083-.165-.745-1.793-1.02-2.455-.275-.66-.55-.572-.745-.583l-.634-.01c-.22 0-.58.082-.883.413-.304.33-1.16 1.133-1.16 2.762 0 1.628 1.187 3.202 1.352 3.422.165.22 2.337 3.567 5.662 5 .793.34 1.41.545 1.893.698.795.252 1.52.216 2.092.13.638-.097 1.96-.802 2.237-1.574.275-.77.275-1.43.193-1.574-.083-.138-.304-.22-.635-.386z" />
      </svg>
      <span className="text-sm font-semibold whitespace-nowrap">Chat with us</span>
    </motion.a>
  );
};

export default WhatsAppButton;
