"use client";

import { useEffect, useState } from "react";

const STEPS = [0.9, 1, 1.1, 1.2, 1.3];

export function TextSizeControl() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("oel-reader-scale"));
      if (STEPS.includes(saved)) setScale(saved);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--reader-scale", String(scale));
    try { localStorage.setItem("oel-reader-scale", String(scale)); } catch {}
  }, [scale]);

  const index = STEPS.indexOf(scale);
  const decrease = () => setScale(STEPS[Math.max(0, index - 1)] ?? 1);
  const increase = () => setScale(STEPS[Math.min(STEPS.length - 1, index + 1)] ?? 1);

  return (
    <section className="textSizeBox">
      <h3>TEKSTSTØRRELSE</h3>
      <div className="textSizeControls">
        <button className="textSizeButton" type="button" onClick={decrease} aria-label="Mindre tekst">−</button>
        <span className="textSizeValue">{Math.round(scale * 100)}%</span>
        <button className="textSizeButton" type="button" onClick={increase} aria-label="Større tekst">+</button>
      </div>
    </section>
  );
}
