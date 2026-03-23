import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, CreditCard, Sparkles } from "lucide-react";

export default function PaymentModal({ isOpen, onClose, onConfirm, loading }) {
  const [selected, setSelected] = useState(1);

  const options = [
    { count: 1, price: 20, label: "Single Render" },
    { count: 5, price: 90, label: "Starter Pack", discount: "10% Off" },
    { count: 10, price: 150, label: "Pro Bundle", discount: "25% Off" },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md surface border border-white/10 rounded-2xl p-8 hero-glow overflow-hidden"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-textSecondary hover:text-white transition-colors"
          >
            <X size={20} />
          </button>

          <div className="flex flex-col items-center text-center mb-8">
            <div className="p-3 rounded-xl bg-accent/10 text-accent mb-4">
              <CreditCard size={28} />
            </div>
            <h3 className="text-xl font-heading text-white">Refill GPU Credits</h3>
            <p className="text-sm text-textSecondary mt-1">
              Select a package to continue processing
            </p>
          </div>

          <div className="space-y-3 mb-8">
            {options.map((opt) => (
              <div
                key={opt.count}
                onClick={() => setSelected(opt.count)}
                className={`group relative p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
                  selected === opt.count
                    ? "bg-accent/10 border-accent shadow-[0_0_15px_rgba(134,245,247,0.1)]"
                    : "bg-white/5 border-white/5 hover:border-white/20"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-lg">
                        {opt.count} Credit{opt.count > 1 ? "s" : ""}
                      </span>
                      {opt.discount && (
                        <span className="text-[10px] bg-accent text-black px-1.5 py-0.5 rounded font-bold uppercase">
                          {opt.discount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-textSecondary">{opt.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">₹{opt.price}</p>
                    <p className="text-[10px] text-textSecondary uppercase">One-time</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={() => onConfirm(selected)}
            disabled={loading}
            className="w-full py-7 bg-accent text-black hover:scale-[1.02] transition-transform font-bold text-md uppercase tracking-wider"
          >
            {loading ? (
              "Initializing..."
            ) : (
              <span className="flex items-center gap-2">
                Proceed to Pay ₹{options.find((o) => o.count === selected).price}
                <Sparkles size={16} />
              </span>
            )}
          </Button>

          <p className="text-[10px] text-center text-textSecondary mt-4 uppercase tracking-widest">
            Securely processed via Razorpay
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}