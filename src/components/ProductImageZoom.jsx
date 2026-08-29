import { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * ProductImageZoom
 * - Desktop (hover): lupa/magnifier que segue o cursor sobre a foto.
 * - Mobile (clique/toque): abre lightbox em tela cheia com pinch-to-zoom
 *   e arraste para mover a imagem ampliada.
 *
 * Uso:
 *   <ProductImageZoom src={imagemAtual} alt={produto.nome} />
 *
 * Sem dependências externas — só React e CSS puro.
 */
export default function ProductImageZoom({ src, alt = "" }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () =>
      setIsMobile(window.matchMedia("(hover: none), (pointer: coarse)").matches);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <>
      <div className="piz-frame">
        {isMobile ? (
          <MobileZoomTrigger src={src} alt={alt} />
        ) : (
          <DesktopHoverZoom src={src} alt={alt} />
        )}
      </div>
      <style>{piz_styles}</style>
    </>
  );
}

/* ---------------- Desktop: hover magnifier ---------------- */

function DesktopHoverZoom({ src, alt }) {
  const containerRef = useRef(null);
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const LENS_SIZE = 160; // px
  const ZOOM = 2.2;

  const handleMove = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPos({
      x: Math.max(0, Math.min(x, rect.width)),
      y: Math.max(0, Math.min(y, rect.height)),
      rectW: rect.width,
      rectH: rect.height,
    });
  }, []);

  return (
    // Wrapper SEM overflow:hidden — é aqui que o painel de resultado se
    // posiciona. O overflow:hidden fica só no .piz-desktop (recorte da foto),
    // senão o painel de zoom nasce cortado por estar fora dos limites dele.
    <div className="piz-desktop-outer">
      <div
        ref={containerRef}
        className="piz-desktop"
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
        onMouseMove={handleMove}
      >
        <img src={src} alt={alt} className="piz-img" draggable={false} />

        {active && (
          <div
            className="piz-lens"
            style={{
              left: pos.x - LENS_SIZE / 2,
              top: pos.y - LENS_SIZE / 2,
              width: LENS_SIZE,
              height: LENS_SIZE,
            }}
          />
        )}
      </div>

      {active && pos.rectW && (
        <div className="piz-result">
          <div
            className="piz-result-img"
            style={{
              backgroundImage: `url(${src})`,
              backgroundSize: `${pos.rectW * ZOOM}px ${pos.rectH * ZOOM}px`,
              backgroundPosition: `${-(pos.x * ZOOM - 140)}px ${-(
                pos.y * ZOOM -
                140
              )}px`,
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ---------------- Mobile: tap to open lightbox with pinch zoom ---------------- */

function MobileZoomTrigger({ src, alt }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="piz-mobile-trigger"
        onClick={() => setOpen(true)}
        aria-label="Ampliar foto"
      >
        <img src={src} alt={alt} className="piz-img" draggable={false} />
        <span className="piz-zoom-hint" aria-hidden="true">
          <ZoomIcon />
        </span>
      </button>

      {open && (
        <PinchLightbox src={src} alt={alt} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function PinchLightbox({ src, alt, onClose }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const state = useRef({
    lastDist: null,
    lastMid: null,
    dragging: false,
    lastPointer: null,
  });

  // trava o scroll do body enquanto o lightbox estiver aberto
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const dist = (t1, t2) =>
    Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  const mid = (t1, t2) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      state.current.lastDist = dist(e.touches[0], e.touches[1]);
      state.current.lastMid = mid(e.touches[0], e.touches[1]);
    } else if (e.touches.length === 1) {
      state.current.dragging = true;
      state.current.lastPointer = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  const onTouchMove = (e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const newDist = dist(e.touches[0], e.touches[1]);
      const newMid = mid(e.touches[0], e.touches[1]);
      if (state.current.lastDist) {
        const factor = newDist / state.current.lastDist;
        setScale((s) => Math.min(4, Math.max(1, s * factor)));
      }
      if (state.current.lastMid) {
        setTranslate((t) => ({
          x: t.x + (newMid.x - state.current.lastMid.x),
          y: t.y + (newMid.y - state.current.lastMid.y),
        }));
      }
      state.current.lastDist = newDist;
      state.current.lastMid = newMid;
    } else if (e.touches.length === 1 && state.current.dragging) {
      const p = e.touches[0];
      const last = state.current.lastPointer;
      setTranslate((t) => ({
        x: t.x + (p.clientX - last.x),
        y: t.y + (p.clientY - last.y),
      }));
      state.current.lastPointer = { x: p.clientX, y: p.clientY };
    }
  };

  const onTouchEnd = (e) => {
    if (e.touches.length === 0) {
      state.current.lastDist = null;
      state.current.lastMid = null;
      state.current.dragging = false;
      // se soltou praticamente sem zoom, recentraliza
      if (scale <= 1.05) {
        setScale(1);
        setTranslate({ x: 0, y: 0 });
      }
    }
  };

  const handleDoubleTap = (() => {
    let lastTap = 0;
    return () => {
      const now = Date.now();
      if (now - lastTap < 300) {
        if (scale > 1) {
          setScale(1);
          setTranslate({ x: 0, y: 0 });
        } else {
          setScale(2.5);
        }
      }
      lastTap = now;
    };
  })();

  // Monta direto no document.body via portal: se algum elemento pai da
  // página (ex: animações de scroll-reveal/fade que usam transform) criar
  // um "containing block", position:fixed passa a se referir a esse pai em
  // vez da tela inteira — o lightbox nasce deslocado/cortado. O portal
  // escapa desse problema garantindo que o fixed sempre cubra a viewport.
  return createPortal(
    <div className="piz-lightbox" role="dialog" aria-modal="true">
      <button
        type="button"
        className="piz-close"
        onClick={onClose}
        aria-label="Fechar"
      >
        ×
      </button>

      <div
        ref={wrapRef}
        className="piz-lightbox-stage"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleDoubleTap}
      >
        <img
          src={src}
          alt={alt}
          className="piz-lightbox-img"
          draggable={false}
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          }}
        />
      </div>

      {scale === 1 && (
        <p className="piz-lightbox-hint">Toque duas vezes ou belisque para ampliar</p>
      )}
    </div>,
    document.body
  );
}

function ZoomIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="11" y1="8" x2="11" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="11" x2="14" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const piz_styles = `
.piz-frame {
  position: relative;
  width: 100%;
}

.piz-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  user-select: none;
}

/* Desktop */
.piz-desktop-outer {
  position: relative;
  width: 100%;
}

.piz-desktop {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 12px;
  cursor: crosshair;
  background: #f4f4f8;
}

.piz-lens {
  position: absolute;
  border: 2px solid #7F77DD;
  background: rgba(127, 119, 221, 0.15);
  pointer-events: none;
  border-radius: 4px;
}

.piz-result {
  position: absolute;
  top: 0;
  left: calc(100% + 16px);
  width: 280px;
  height: 280px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #EEEDFE;
  box-shadow: 0 8px 24px rgba(83, 74, 183, 0.18);
  background: #fff;
  z-index: 50;
  pointer-events: none;
}

.piz-result-img {
  width: 100%;
  height: 100%;
  background-repeat: no-repeat;
}

/* Mobile trigger */
.piz-mobile-trigger {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border: none;
  padding: 0;
  margin: 0;
  background: #f4f4f8;
  border-radius: 12px;
  overflow: hidden;
  display: block;
}

.piz-zoom-hint {
  position: absolute;
  bottom: 10px;
  right: 10px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(83, 74, 183, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Lightbox */
.piz-lightbox {
  position: fixed;
  inset: 0;
  background: rgba(20, 18, 34, 0.96);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  touch-action: none;
}

.piz-lightbox-stage {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.piz-lightbox-img {
  max-width: 100%;
  max-height: 100%;
  touch-action: none;
  transition: transform 0.05s linear;
}

.piz-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 24px;
  line-height: 1;
  z-index: 1001;
}

.piz-lightbox-hint {
  position: absolute;
  bottom: 28px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  text-align: center;
  width: 100%;
}
`;