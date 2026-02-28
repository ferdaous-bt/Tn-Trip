import { useState, useEffect } from "react";
import { SLIDES } from "../constants/slides";
import { TN, F } from "../constants/theme";

export default function Carousel() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIdx((i) => (i + 1) % SLIDES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[idx];

  return (
    <div
      style={{
        position: "relative",
        height: 450,
        width: 600,
        borderRadius: 24,
        overflow: "hidden",
        margin: "0 auto 20px",
        boxShadow: TN.shadowLg
      }}
    >
      <img
        src={slide.img}
        alt={slide.t}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center"
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg,transparent 40%,rgba(0,0,0,.7) 100%)"
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          display: "flex",
          gap: 6
        }}
      >
        {SLIDES.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === idx ? 28 : 8,
              height: 8,
              borderRadius: 4,
              background: i === idx ? "#fff" : "rgba(255,255,255,0.5)",
              transition: "all 0.3s ease",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
            }}
            onClick={() => setIdx(i)}
          />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 24,
          right: 24
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            fontFamily: F,
            color: "#fff",
            textShadow: "0 3px 16px rgba(0,0,0,.8)",
            letterSpacing: "-0.5px"
          }}
        >
          {slide.t}
        </div>
        <div
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.95)",
            marginTop: 4,
            textShadow: "0 2px 8px rgba(0,0,0,.6)"
          }}
        >
          {slide.s}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          fontSize: 11,
          fontWeight: 700,
          background: "rgba(0,0,0,.5)",
          color: "#fff",
          borderRadius: 8,
          padding: "6px 12px",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.2)"
        }}
      >
        {idx + 1}/{SLIDES.length}
      </div>
    </div>
  );
}
