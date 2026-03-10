import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function VideoCompare({ before, after }) {
  const containerRef = useRef(null);
  const beforeRef = useRef(null);
  const afterRef = useRef(null);

  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [userTouched, setUserTouched] = useState(false);

  const updatePosition = (clientX) => {
    const rect = containerRef.current.getBoundingClientRect();
    const percent = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, percent)));
  };

  const handleMove = (e) => {
    if (!dragging) return;
    updatePosition(e.clientX);
  };

  // Sync videos
  useEffect(() => {
    const sync = () => {
      if (!beforeRef.current || !afterRef.current) return;

      const diff = Math.abs(
        beforeRef.current.currentTime - afterRef.current.currentTime,
      );

      if (diff > 0.03) {
        beforeRef.current.currentTime = afterRef.current.currentTime;
      }
    };

    const id = setInterval(sync, 60);
    return () => clearInterval(id);
  }, []);

  // Auto demo slider motion
  useEffect(() => {
    if (userTouched) return;

    let direction = 1;
    let intervalId;

    const startDemo = setTimeout(() => {
      intervalId = setInterval(() => {
        setPos((p) => {
          if (p > 75) direction = -1;
          if (p < 25) direction = 1;
          return p + direction * 0.2;
        });
      }, 16);
    }, 3000); // 2 second delay

    return () => {
      clearTimeout(startDemo);
      clearInterval(intervalId);
    };
  }, [userTouched]);

  return (
    <div
      ref={containerRef}
      className="relative w-[600px] max-w-full aspect-video rounded-2xl overflow-hidden surface hero-glow select-none cursor-ew-resize"
      onMouseMove={handleMove}
      onMouseDown={(e) => {
        setDragging(true);
        setUserTouched(true);
        updatePosition(e.clientX);
      }}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
    >
      {/* AFTER VIDEO */}
      <video
        ref={afterRef}
        src={after}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* BEFORE VIDEO */}
      <video
        ref={beforeRef}
        src={before}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          clipPath: `inset(0 ${100 - pos}% 0 0)`,
        }}
      />

      {/* Divider Glow */}
      <div
        className="absolute top-0 bottom-0 w-[2px] bg-accent"
        style={{
          left: `${pos}%`,
          transform: "translateX(-50%)",
        }}
      />

      {/* Light bloom */}
      <div
        className="absolute top-0 bottom-0 w-[80px] pointer-events-none"
        style={{
          left: `${pos}%`,
          transform: "translateX(-50%)",
          background:
            "linear-gradient(to right, transparent, rgba(0,255,255,0.15), transparent)",
        }}
      />

      {/* Premium Handle */}
      <motion.div
        className="absolute flex items-center justify-center cursor-ew-resize"
        style={{
          left: `${pos}%`,
          top: "50%",
          x: "-50%",
          y: "-50%",
        }}
        whileHover={{ scale: 1.15 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <div className="relative w-14 h-14 rounded-full bg-white/10 backdrop-blur-lg border border-white/30 shadow-xl flex items-center justify-center">
          {/* arrows */}
          <div className="absolute left-3 text-white/70 text-xs">◀</div>
          <div className="absolute right-3 text-white/70 text-xs">▶</div>

          {/* center bar */}
          <div className="w-[2px] h-6 bg-accent shadow-[0_0_10px_rgba(0,255,255,0.8)]" />
        </div>
      </motion.div>

      {/* Labels */}
      <div className="absolute top-4 left-4 text-xs bg-black/60 px-3 py-1 rounded-md backdrop-blur">
        Original
      </div>

      <div className="absolute top-4 right-4 text-xs bg-black/60 px-3 py-1 rounded-md backdrop-blur">
        Interpolated
      </div>
    </div>
  );
}
