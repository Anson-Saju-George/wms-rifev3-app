import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function VideoCompare({ before, after }) {
  const containerRef = useRef(null);
  const beforeRef = useRef(null);
  const afterRef = useRef(null);

  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [userTouched, setUserTouched] = useState(false);
  const [bothReady, setBothReady] = useState(false); // ← new

  const updatePosition = (clientX) => {
    const rect = containerRef.current.getBoundingClientRect();
    const percent = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, percent)));
  };

  const handleMove = (e) => {
    if (!dragging) return;
    updatePosition(e.clientX);
  };

  // ── Wait for both videos to fully buffer before playing ──────────────────
  useEffect(() => {
    const bv = beforeRef.current;
    const av = afterRef.current;
    if (!bv || !av) return;

    // Pause both until ready
    bv.pause();
    av.pause();

    let beforeReady = false;
    let afterReady = false;

    const tryPlay = () => {
      if (!beforeReady || !afterReady) return;
      // Reset both to start, then play in sync
      bv.currentTime = 0;
      av.currentTime = 0;
      bv.play();
      av.play();
      setBothReady(true);
    };

    const onBeforeReady = () => { beforeReady = true; tryPlay(); };
    const onAfterReady  = () => { afterReady  = true; tryPlay(); };

    // readyState 4 = HAVE_ENOUGH_DATA (fully buffered to play through)
    if (bv.readyState === 4) onBeforeReady();
    else bv.addEventListener("canplaythrough", onBeforeReady, { once: true });

    if (av.readyState === 4) onAfterReady();
    else av.addEventListener("canplaythrough", onAfterReady, { once: true });

    return () => {
      bv.removeEventListener("canplaythrough", onBeforeReady);
      av.removeEventListener("canplaythrough", onAfterReady);
    };
  }, []);

  // ── Sync drift correction (only runs after both are ready) ───────────────
  useEffect(() => {
    if (!bothReady) return;

    const id = setInterval(() => {
      const bv = beforeRef.current;
      const av = afterRef.current;
      if (!bv || !av) return;
      if (Math.abs(bv.currentTime - av.currentTime) > 0.03) {
        bv.currentTime = av.currentTime;
      }
    }, 60);

    return () => clearInterval(id);
  }, [bothReady]);

  // ── Auto demo slider (only after both ready) ─────────────────────────────
  useEffect(() => {
    if (userTouched || !bothReady) return;

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
    }, 3000);

    return () => {
      clearTimeout(startDemo);
      clearInterval(intervalId);
    };
  }, [userTouched, bothReady]);

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
      {/* AFTER VIDEO — no autoPlay, controlled by useEffect */}
      <video
        ref={afterRef}
        src={after}
        loop
        muted
        playsInline
        preload="auto"          // ← tells browser to buffer the full file
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* BEFORE VIDEO */}
      <video
        ref={beforeRef}
        src={before}
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />

      {/* Loading overlay */}
      {!bothReady && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-cyan-400 animate-spin" />
            <span className="text-white/70 text-xs tracking-widest uppercase">
              Loading videos…
            </span>
          </div>
        </div>
      )}

      {/* Divider Glow */}
      <div
        className="absolute top-0 bottom-0 w-[2px] bg-accent"
        style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
      />

      {/* Light bloom */}
      <div
        className="absolute top-0 bottom-0 w-[80px] pointer-events-none"
        style={{
          left: `${pos}%`,
          transform: "translateX(-50%)",
          background: "linear-gradient(to right, transparent, rgba(0,255,255,0.15), transparent)",
        }}
      />

      {/* Premium Handle */}
      <motion.div
        className="absolute flex items-center justify-center cursor-ew-resize"
        style={{ left: `${pos}%`, top: "50%", x: "-50%", y: "-50%" }}
        whileHover={{ scale: 1.15 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <div className="relative w-14 h-14 rounded-full bg-white/10 backdrop-blur-lg border border-white/30 shadow-xl flex items-center justify-center">
          <div className="absolute left-3 text-white/70 text-xs">◀</div>
          <div className="absolute right-3 text-white/70 text-xs">▶</div>
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