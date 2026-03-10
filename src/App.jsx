import { Routes, Route } from "react-router-dom";
import { motion } from "framer-motion";

import Hero from "./pages/Hero";
import Research from "./pages/Research";
import Navbar from "./components/Navbar";

export default function App() {
  return (
    <>
      <Navbar />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <Routes>

          <Route index element={<Hero />} />

          <Route path="research" element={<Research />} />

        </Routes>
      </motion.div>
    </>
  );
}