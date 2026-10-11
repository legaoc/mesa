export type SceneId = "papel" | "estudio" | "tinta" | "blanco";
export type FinishId = "grafito" | "plata" | "arena";
export type FitMode = "cover" | "contain";
export type GroupId = "Dispositivos" | "Pantalla" | "Impresión";

export type Rect = { x: number; y: number; w: number; h: number; r: number };

export type Template = {
  id: string;
  name: string;
  group: GroupId;
  w: number;
  h: number;
  hardware: boolean;
  note: string;
};

type Finish = { hi: string; lo: string; edge: string; bezel: string; button: string };

const FINISH: Record<FinishId, Finish> = {
  grafito: {
    hi: "#3c3a36",
    lo: "#141311",
    edge: "rgba(255,252,247,0.22)",
    bezel: "#0c0b0a",
    button: "#4a4742",
  },
  plata: {
    hi: "#f6f2ea",
    lo: "#c2bbb0",
    edge: "rgba(255,252,247,0.85)",
    bezel: "#26231f",
    button: "#b2aba0",
  },
  arena: {
    hi: "#f3e0c8",
    lo: "#c4a27c",
    edge: "rgba(255,252,247,0.6)",
    bezel: "#2a221b",
    button: "#d4b48e",
  },
};

export type ArtState = {
  image: HTMLImageElement | null;
  zoom: number;
  panX: number;
  panY: number;
  fit: FitMode;
};

export type RenderOptions = {
  scene: SceneId;
  finish: FinishId;
  art: ArtState;
  quiet?: boolean;
};

type Layout = {
  w: number;
  h: number;
  screen: Rect;
  draw: (ctx: CanvasRenderingContext2D, opts: RenderOptions) => void;
};

const SCENE_STOPS: Record<SceneId, [string, string]> = {
  papel: ["#f7f4ee", "#e3dcd0"],
  estudio: ["#e8e2d6", "#cfc6b6"],
  tinta: ["#201e1b", "#100f0e"],
  blanco: ["#ffffff", "#f1eee8"],
};

let noiseCanvas: HTMLCanvasElement | null = null;
let noisePattern: CanvasPattern | null = null;

function traceRound(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (rad <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function fillRound(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  traceRound(ctx, x, y, w, h, r);
  ctx.fill();
}

function softShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  alpha: number,
) {
  const steps = 7;
  for (let i = steps; i >= 1; i--) {
    const t = i / steps;
    ctx.beginPath();
    ctx.fillStyle = `rgba(22,21,19,${alpha * 0.11 * t})`;
    ctx.ellipse(
      cx,
      cy,
      rx * (1 + (1 - t) * 0.4),
      ry * (1 + (1 - t) * 0.85),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function paintScene(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneId) {
  const [a, b] = SCENE_STOPS[scene];
  const g = ctx.createRadialGradient(w * 0.5, h * 0.38, w * 0.05, w * 0.5, h * 0.55, w * 0.78);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  if (!noiseCanvas) {
    noiseCanvas = document.createElement("canvas");
    noiseCanvas.width = 128;
    noiseCanvas.height = 128;
    const nctx = noiseCanvas.getContext("2d");
    if (nctx) {
      const img = nctx.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 80 + Math.random() * 90;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = Math.random() > 0.78 ? 32 : 0;
      }
      nctx.putImageData(img, 0, 0);
    }
  }
  if (!noisePattern) noisePattern = ctx.createPattern(noiseCanvas, "repeat");
  if (noisePattern) {
    ctx.save();
    ctx.globalAlpha = scene === "tinta" ? 0.22 : 0.4;
    ctx.fillStyle = noisePattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

function shadowAlpha(scene: SceneId) {
  return scene === "tinta" ? 0.55 : 0.28;
}

function drawArt(ctx: CanvasRenderingContext2D, rect: Rect, art: ArtState, quiet?: boolean) {
  ctx.save();
  traceRound(ctx, rect.x, rect.y, rect.w, rect.h, rect.r);
  ctx.clip();
  ctx.fillStyle = "#1c1a17";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  const img = art.image;
  if (img && img.complete && img.naturalWidth > 0) {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const base =
      art.fit === "contain" ? Math.min(rect.w / iw, rect.h / ih) : Math.max(rect.w / iw, rect.h / ih);
    const scale = base * art.zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    const ox = rect.x + (rect.w - dw) / 2 + art.panX;
    const oy = rect.y + (rect.h - dh) / 2 + art.panY;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, ox, oy, dw, dh);
  } else if (!quiet) {
    ctx.fillStyle = "#2a2723";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = "rgba(243,241,236,0.35)";
    ctx.setLineDash([10, 12]);
    ctx.lineWidth = 2;
    const inset = 28;
    traceRound(
      ctx,
      rect.x + inset,
      rect.y + inset,
      rect.w - inset * 2,
      rect.h - inset * 2,
      Math.max(0, rect.r - 12),
    );
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#f3f1ec";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "560 42px Fraunces, Georgia, serif";
    ctx.fillText("Sube tu imagen", rect.x + rect.w / 2, rect.y + rect.h / 2 - 16);
    ctx.font = "400 22px Outfit, sans-serif";
    ctx.fillStyle = "#a39e96";
    ctx.fillText("JPG o PNG", rect.x + rect.w / 2, rect.y + rect.h / 2 + 28);
  }

  ctx.restore();
}

function glass(ctx: CanvasRenderingContext2D, rect: Rect) {
  ctx.save();
  traceRound(ctx, rect.x, rect.y, rect.w, rect.h, rect.r);
  ctx.clip();
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w * 0.65, rect.y + rect.h * 0.4);
  g.addColorStop(0, "rgba(255,252,247,0.18)");
  g.addColorStop(0.42, "rgba(255,252,247,0)");
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h * 0.55);
  ctx.restore();
}

function paintBody(
  ctx: CanvasRenderingContext2D,
  body: Rect,
  finish: Finish,
) {
  const g = ctx.createLinearGradient(body.x, body.y, body.x + body.w * 0.15, body.y + body.h);
  g.addColorStop(0, finish.hi);
  g.addColorStop(0.55, finish.lo);
  g.addColorStop(1, finish.lo);
  ctx.fillStyle = g;
  fillRound(ctx, body.x, body.y, body.w, body.h, body.r);
  ctx.save();
  traceRound(ctx, body.x + 1, body.y + 1, body.w - 2, body.h - 2, body.r);
  ctx.strokeStyle = finish.edge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function phoneLayout(landscape: boolean): { w: number; h: number; body: Rect; screen: Rect } {
  if (!landscape) {
    const w = 980;
    const h = 1760;
    const bw = 620;
    const bh = 1300;
    const x = (w - bw) / 2;
    const y = (h - bh) / 2 - 10;
    const inset = 16;
    return {
      w,
      h,
      body: { x, y, w: bw, h: bh, r: 92 },
      screen: {
        x: x + inset,
        y: y + inset,
        w: bw - inset * 2,
        h: bh - inset * 2,
        r: 78,
      },
    };
  }
  const w = 1760;
  const h = 980;
  const bw = 1300;
  const bh = 620;
  const x = (w - bw) / 2;
  const y = (h - bh) / 2 + 6;
  const inset = 16;
  return {
    w,
    h,
    body: { x, y, w: bw, h: bh, r: 92 },
    screen: {
      x: x + inset,
      y: y + inset,
      w: bw - inset * 2,
      h: bh - inset * 2,
      r: 78,
    },
  };
}

function drawPhone(ctx: CanvasRenderingContext2D, opts: RenderOptions, landscape: boolean) {
  const { w, h, body, screen } = phoneLayout(landscape);
  const finish = FINISH[opts.finish];
  paintScene(ctx, w, h, opts.scene);
  softShadow(
    ctx,
    body.x + body.w / 2,
    body.y + body.h - 8,
    body.w * 0.38,
    26,
    shadowAlpha(opts.scene),
  );
  ctx.fillStyle = finish.button;
  if (!landscape) {
    fillRound(ctx, body.x - 5, body.y + 210, 6, 64, 2);
    fillRound(ctx, body.x - 5, body.y + 292, 6, 96, 2);
    fillRound(ctx, body.x + body.w - 1, body.y + 250, 6, 120, 2);
  } else {
    fillRound(ctx, body.x + 210, body.y - 5, 64, 6, 2);
    fillRound(ctx, body.x + 292, body.y - 5, 96, 6, 2);
    fillRound(ctx, body.x + 250, body.y + body.h - 1, 120, 6, 2);
  }
  paintBody(ctx, body, finish);
  ctx.fillStyle = finish.bezel;
  fillRound(ctx, screen.x - 2, screen.y - 2, screen.w + 4, screen.h + 4, screen.r + 2);
  drawArt(ctx, screen, opts.art, opts.quiet);
  glass(ctx, screen);
  ctx.fillStyle = "#070706";
  if (!landscape) {
    fillRound(ctx, screen.x + (screen.w - 124) / 2, screen.y + 16, 124, 36, 18);
  } else {
    fillRound(ctx, screen.x + 16, screen.y + (screen.h - 124) / 2, 36, 124, 18);
  }
}

function laptopLayout() {
  const w = 1800;
  const h = 1220;
  const lid = { x: 250, y: 70, w: 1300, h: 820, r: 22 };
  const bezel = 20;
  const screen = {
    x: lid.x + bezel,
    y: lid.y + bezel + 8,
    w: lid.w - bezel * 2,
    h: lid.h - bezel * 2 - 22,
    r: 8,
  };
  const base = { x: 190, y: lid.y + lid.h + 8, w: 1420, h: 86, r: 14 };
  return { w, h, lid, screen, base };
}

function drawLaptop(ctx: CanvasRenderingContext2D, opts: RenderOptions) {
  const { w, h, lid, screen, base } = laptopLayout();
  const finish = FINISH[opts.finish];
  paintScene(ctx, w, h, opts.scene);
  softShadow(ctx, w / 2, base.y + base.h - 6, base.w * 0.42, 22, shadowAlpha(opts.scene));
  paintBody(ctx, lid, finish);
  ctx.fillStyle = finish.bezel;
  fillRound(ctx, screen.x - 3, screen.y - 3, screen.w + 6, screen.h + 6, screen.r + 2);
  drawArt(ctx, screen, opts.art, opts.quiet);
  glass(ctx, screen);
  ctx.fillStyle = finish.lo;
  ctx.beginPath();
  ctx.arc(lid.x + lid.w / 2, lid.y + 16, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,252,247,0.55)";
  ctx.beginPath();
  ctx.arc(lid.x + lid.w / 2, lid.y + 16, 1.6, 0, Math.PI * 2);
  ctx.fill();

  const deck = ctx.createLinearGradient(base.x, base.y, base.x, base.y + base.h);
  deck.addColorStop(0, finish.hi);
  deck.addColorStop(1, finish.lo);
  ctx.fillStyle = deck;
  fillRound(ctx, base.x, base.y, base.w, base.h, base.r);
  ctx.fillStyle = finish.button;
  const keysX = base.x + 90;
  const keysY = base.y + 14;
  const keysW = base.w - 180;
  const cols = 18;
  const rows = 3;
  const gap = 5;
  const kw = (keysW - gap * (cols - 1)) / cols;
  const kh = 8;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      fillRound(ctx, keysX + col * (kw + gap), keysY + row * (kh + gap), kw, kh, 2);
    }
  }
  fillRound(ctx, base.x + base.w / 2 - 90, base.y + base.h - 22, 180, 10, 5);
}

function tabletLayout() {
  const w = 1280;
  const h = 1680;
  const bw = 900;
  const bh = 1240;
  const x = (w - bw) / 2;
  const y = (h - bh) / 2 - 8;
  const inset = 22;
  return {
    w,
    h,
    body: { x, y, w: bw, h: bh, r: 48 },
    screen: { x: x + inset, y: y + inset, w: bw - inset * 2, h: bh - inset * 2, r: 18 },
  };
}

function drawTablet(ctx: CanvasRenderingContext2D, opts: RenderOptions) {
  const { w, h, body, screen } = tabletLayout();
  const finish = FINISH[opts.finish];
  paintScene(ctx, w, h, opts.scene);
  softShadow(ctx, w / 2, body.y + body.h - 4, body.w * 0.36, 24, shadowAlpha(opts.scene));
  paintBody(ctx, body, finish);
  ctx.fillStyle = finish.bezel;
  fillRound(ctx, screen.x - 2, screen.y - 2, screen.w + 4, screen.h + 4, screen.r + 2);
  drawArt(ctx, screen, opts.art, opts.quiet);
  glass(ctx, screen);
  ctx.fillStyle = finish.lo;
  ctx.beginPath();
  ctx.arc(body.x + body.w / 2, body.y + 12, 4, 0, Math.PI * 2);
  ctx.fill();
}

function monitorLayout() {
  const w = 1800;
  const h = 1240;
  const bezel = { x: 210, y: 64, w: 1380, h: 820, r: 16 };
  const screen = {
    x: bezel.x + 18,
    y: bezel.y + 18,
    w: bezel.w - 36,
    h: bezel.h - 64,
    r: 6,
  };
  return { w, h, bezel, screen };
}

function drawMonitor(ctx: CanvasRenderingContext2D, opts: RenderOptions) {
  const { w, h, bezel, screen } = monitorLayout();
  const finish = FINISH[opts.finish];
  paintScene(ctx, w, h, opts.scene);
  const footY = bezel.y + bezel.h + 150;
  softShadow(ctx, w / 2, footY + 8, 280, 18, shadowAlpha(opts.scene));
  paintBody(ctx, bezel, finish);
  ctx.fillStyle = finish.bezel;
  fillRound(ctx, screen.x - 2, screen.y - 2, screen.w + 4, screen.h + 4, 8);
  drawArt(ctx, screen, opts.art, opts.quiet);
  glass(ctx, screen);
  ctx.fillStyle = finish.lo;
  ctx.beginPath();
  ctx.arc(bezel.x + bezel.w / 2, bezel.y + bezel.h - 22, 4, 0, Math.PI * 2);
  ctx.fill();

  const neckTop = bezel.y + bezel.h - 4;
  ctx.fillStyle = finish.lo;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 36, neckTop);
  ctx.lineTo(w / 2 + 36, neckTop);
  ctx.lineTo(w / 2 + 48, footY);
  ctx.lineTo(w / 2 - 48, footY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = finish.hi;
  fillRound(ctx, w / 2 - 230, footY - 4, 460, 18, 9);
}

function browserLayout() {
  const w = 1680;
  const h = 1100;
  const win = { x: 130, y: 80, w: 1420, h: 920, r: 18 };
  const bar = 64;
  const screen = {
    x: win.x,
    y: win.y + bar,
    w: win.w,
    h: win.h - bar,
    r: 0,
  };
  return { w, h, win, bar, screen };
}

function drawBrowser(ctx: CanvasRenderingContext2D, opts: RenderOptions) {
  const { w, h, win, bar, screen } = browserLayout();
  const dark = opts.scene === "tinta";
  const chrome = dark ? "#221f1c" : "#fffcf7";
  const pill = dark ? "#2e2b27" : "#f3f1ec";
  const label = dark ? "#a39e96" : "#6f6a64";
  paintScene(ctx, w, h, opts.scene);
  softShadow(ctx, w / 2, win.y + win.h - 10, win.w * 0.4, 28, shadowAlpha(opts.scene));
  ctx.fillStyle = chrome;
  fillRound(ctx, win.x, win.y, win.w, win.h, win.r);
  ctx.save();
  traceRound(ctx, win.x, win.y, win.w, win.h, win.r);
  ctx.clip();
  drawArt(ctx, screen, opts.art, opts.quiet);
  ctx.fillStyle = chrome;
  ctx.fillRect(win.x, win.y, win.w, bar);
  const dots = ["#c4554a", "#d4a054", "#7d9a62"];
  dots.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(win.x + 36 + i * 22, win.y + bar / 2, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = pill;
  fillRound(ctx, win.x + win.w / 2 - 220, win.y + 16, 440, 32, 16);
  ctx.fillStyle = label;
  ctx.font = "500 16px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("mesa.studio / preview", win.x + win.w / 2, win.y + bar / 2);
  ctx.restore();
  ctx.save();
  traceRound(ctx, win.x + 1, win.y + 1, win.w - 2, win.h - 2, win.r);
  ctx.strokeStyle = dark ? "rgba(255,252,247,0.08)" : "#e4dfd6";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function posterLayout() {
  const w = 1400;
  const h = 1800;
  const sheet = { x: 300, y: 250, w: 800, h: 1160, r: 2 };
  const mat = 64;
  const screen = {
    x: sheet.x + mat,
    y: sheet.y + mat,
    w: sheet.w - mat * 2,
    h: sheet.h - mat * 2 - 36,
    r: 0,
  };
  return { w, h, sheet, screen };
}

function tape(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = "rgba(196, 168, 112, 0.45)";
  fillRound(ctx, -46, -14, 92, 28, 2);
  ctx.restore();
}

function drawPoster(ctx: CanvasRenderingContext2D, opts: RenderOptions) {
  const { w, h, sheet, screen } = posterLayout();
  paintScene(ctx, w, h, opts.scene);
  softShadow(ctx, sheet.x + sheet.w / 2 + 8, sheet.y + sheet.h - 6, sheet.w * 0.42, 26, shadowAlpha(opts.scene));
  ctx.fillStyle = "#fffcf7";
  fillRound(ctx, sheet.x, sheet.y, sheet.w, sheet.h, sheet.r);
  drawArt(ctx, screen, opts.art, opts.quiet);
  ctx.strokeStyle = "#e4dfd6";
  ctx.lineWidth = 1;
  ctx.strokeRect(screen.x, screen.y, screen.w, screen.h);
  ctx.fillStyle = "#6f6a64";
  ctx.font = "500 18px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("MESA  ·  IMPRESIÓN", sheet.x + sheet.w / 2, sheet.y + sheet.h - 40);
  tape(ctx, sheet.x + 70, sheet.y + 8, -0.12);
  tape(ctx, sheet.x + sheet.w - 70, sheet.y + 6, 0.14);
}

function cardLayout() {
  const w = 1600;
  const h = 1040;
  const card = { x: 360, y: 270, w: 900, h: 520, r: 22 };
  return { w, h, card, screen: { ...card } };
}

function drawCard(ctx: CanvasRenderingContext2D, opts: RenderOptions) {
  const { w, h, card, screen } = cardLayout();
  paintScene(ctx, w, h, opts.scene);
  ctx.save();
  ctx.translate(card.x + 40, card.y - 24);
  ctx.rotate(-0.08);
  softShadow(ctx, card.w / 2, card.h * 0.92, card.w * 0.4, 20, shadowAlpha(opts.scene) * 0.7);
  ctx.fillStyle = "#e7e1d6";
  fillRound(ctx, 0, 0, card.w, card.h, card.r);
  ctx.restore();
  softShadow(ctx, card.x + card.w / 2, card.y + card.h - 8, card.w * 0.4, 20, shadowAlpha(opts.scene));
  drawArt(ctx, screen, opts.art, opts.quiet);
  ctx.save();
  traceRound(ctx, card.x, card.y, card.w, card.h, card.r);
  ctx.strokeStyle = "rgba(22,21,19,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function magazineLayout() {
  const w = 1800;
  const h = 1200;
  const spread = { x: 110, y: 130, w: 1580, h: 940, r: 4 };
  const gutter = spread.x + spread.w / 2;
  const screen = {
    x: gutter + 36,
    y: spread.y + 36,
    w: spread.w / 2 - 72,
    h: spread.h - 72,
    r: 0,
  };
  return { w, h, spread, gutter, screen };
}

function ruleColumn(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  lines: number[],
) {
  ctx.fillStyle = "#d9d3c8";
  let cy = y;
  for (const frac of lines) {
    ctx.fillRect(x, cy, width * frac, 8);
    cy += 20;
  }
}

function drawMagazine(ctx: CanvasRenderingContext2D, opts: RenderOptions) {
  const { w, h, spread, gutter, screen } = magazineLayout();
  paintScene(ctx, w, h, opts.scene);
  softShadow(ctx, w / 2, spread.y + spread.h - 8, spread.w * 0.4, 24, shadowAlpha(opts.scene));
  ctx.fillStyle = "#fffcf7";
  fillRound(ctx, spread.x, spread.y, spread.w, spread.h, spread.r);
  ctx.fillStyle = "rgba(22,21,19,0.08)";
  ctx.fillRect(gutter - 8, spread.y, 16, spread.h);

  const left = spread.x + 56;
  ctx.fillStyle = "#161513";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "650 72px Fraunces, Georgia, serif";
  ctx.fillText("Mesa", left, spread.y + 130);
  ctx.fillStyle = "#9c4221";
  ctx.font = "500 18px Outfit, sans-serif";
  ctx.fillText("CUADERNO DE ESTUDIO", left, spread.y + 168);
  ruleColumn(ctx, left, spread.y + 230, 560, [1, 0.92, 0.84, 0.96, 0.7, 1, 0.88, 0.6, 0.94, 0.8, 0.5]);
  ctx.fillStyle = "#6f6a64";
  ctx.font = "500 16px Outfit, sans-serif";
  ctx.fillText("01", left, spread.y + spread.h - 40);

  drawArt(ctx, screen, opts.art, opts.quiet);
}

function sheetLayout() {
  const w = 1300;
  const h = 1720;
  const paper = { x: 210, y: 180, w: 880, h: 1280, r: 2 };
  const inset = 48;
  const screen = {
    x: paper.x + inset,
    y: paper.y + inset,
    w: paper.w - inset * 2,
    h: paper.h - inset * 2,
    r: 0,
  };
  return { w, h, paper, screen };
}

function drawSheet(ctx: CanvasRenderingContext2D, opts: RenderOptions) {
  const { w, h, paper, screen } = sheetLayout();
  paintScene(ctx, w, h, opts.scene);
  softShadow(ctx, paper.x + paper.w / 2 + 10, paper.y + paper.h - 4, paper.w * 0.42, 22, shadowAlpha(opts.scene));
  ctx.fillStyle = "#fffcf7";
  fillRound(ctx, paper.x, paper.y, paper.w, paper.h, 2);
  drawArt(ctx, screen, opts.art, opts.quiet);
}

function bookLayout() {
  const w = 1240;
  const h = 1680;
  const cover = { x: 250, y: 200, w: 720, h: 1120, r: 3 };
  const spine = 28;
  const screen = {
    x: cover.x + spine,
    y: cover.y,
    w: cover.w - spine,
    h: cover.h,
    r: 0,
  };
  return { w, h, cover, screen };
}

function drawBook(ctx: CanvasRenderingContext2D, opts: RenderOptions) {
  const { w, h, cover, screen } = bookLayout();
  paintScene(ctx, w, h, opts.scene);
  softShadow(ctx, cover.x + cover.w / 2 + 30, cover.y + cover.h - 6, cover.w * 0.4, 22, shadowAlpha(opts.scene));
  ctx.fillStyle = "#f4f0e8";
  for (let i = 5; i >= 0; i--) {
    ctx.fillStyle = i % 2 === 0 ? "#f7f4ee" : "#e4dfd6";
    ctx.fillRect(cover.x + cover.w + i * 4, cover.y + 10, 4, cover.h - 20);
  }
  ctx.fillStyle = "#1a1714";
  ctx.fillRect(cover.x, cover.y, cover.w, cover.h);
  drawArt(ctx, screen, opts.art, opts.quiet);
  const spineG = ctx.createLinearGradient(cover.x, 0, cover.x + 28, 0);
  spineG.addColorStop(0, "#141210");
  spineG.addColorStop(0.7, "#3a342e");
  spineG.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = spineG;
  ctx.fillRect(cover.x, cover.y, 28, cover.h);
}

function newsLayout() {
  const w = 1400;
  const h = 1860;
  const paper = { x: 160, y: 110, w: 1080, h: 1600, r: 2 };
  const screen = { x: 210, y: 340, w: 980, h: 640, r: 0 };
  return { w, h, paper, screen };
}

function drawNews(ctx: CanvasRenderingContext2D, opts: RenderOptions) {
  const { w, h, paper, screen } = newsLayout();
  paintScene(ctx, w, h, opts.scene);
  softShadow(ctx, paper.x + paper.w / 2, paper.y + paper.h - 8, paper.w * 0.4, 22, shadowAlpha(opts.scene));
  ctx.fillStyle = "#fffcf7";
  fillRound(ctx, paper.x, paper.y, paper.w, paper.h, 2);
  ctx.strokeStyle = "#161513";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(paper.x + 48, paper.y + 78);
  ctx.lineTo(paper.x + paper.w - 48, paper.y + 78);
  ctx.moveTo(paper.x + 48, paper.y + 168);
  ctx.lineTo(paper.x + paper.w - 48, paper.y + 168);
  ctx.stroke();
  ctx.fillStyle = "#161513";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "650 78px Fraunces, Georgia, serif";
  ctx.fillText("Mesa", paper.x + paper.w / 2, paper.y + 124);
  ctx.font = "500 16px Outfit, sans-serif";
  ctx.fillStyle = "#6f6a64";
  ctx.fillText("EDICIÓN DE ESTUDIO", paper.x + paper.w / 2, paper.y + 190);
  drawArt(ctx, screen, opts.art, opts.quiet);
  const colW = 300;
  const gap = 40;
  const startX = paper.x + 50;
  const y0 = screen.y + screen.h + 36;
  const pattern = [1, 0.9, 0.95, 0.7, 1, 0.82, 0.6, 0.94, 0.88, 0.55];
  for (let c = 0; c < 3; c++) {
    ruleColumn(ctx, startX + c * (colW + gap), y0, colW, pattern);
  }
}

function billboardLayout() {
  const w = 1800;
  const h = 1120;
  const panel = { x: 230, y: 120, w: 1340, h: 680, r: 4 };
  const screen = { x: panel.x + 22, y: panel.y + 22, w: panel.w - 44, h: panel.h - 44, r: 0 };
  return { w, h, panel, screen };
}

function drawBillboard(ctx: CanvasRenderingContext2D, opts: RenderOptions) {
  const { w, h, panel, screen } = billboardLayout();
  paintScene(ctx, w, h, opts.scene);
  ctx.fillStyle = opts.scene === "tinta" ? "#2a2723" : "#d9d2c4";
  ctx.fillRect(0, h - 180, w, 180);
  ctx.fillStyle = "#3a3632";
  ctx.fillRect(panel.x + 110, panel.y + panel.h, 16, h - panel.y - panel.h - 40);
  ctx.fillRect(panel.x + panel.w - 126, panel.y + panel.h, 16, h - panel.y - panel.h - 40);
  ctx.fillStyle = "#1a1816";
  fillRound(ctx, panel.x, panel.y, panel.w, panel.h, panel.r);
  drawArt(ctx, screen, opts.art, opts.quiet);
  ctx.fillStyle = "#c45c26";
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(panel.x + 80 + i * 145, panel.y - 16, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function frameLayout() {
  const w = 1500;
  const h = 1760;
  const outer = { x: 310, y: 230, w: 880, h: 1160, r: 2 };
  const molding = 70;
  const mat = 36;
  const screen = {
    x: outer.x + molding + mat,
    y: outer.y + molding + mat,
    w: outer.w - (molding + mat) * 2,
    h: outer.h - (molding + mat) * 2,
    r: 0,
  };
  return { w, h, outer, screen, molding };
}

function drawFrame(ctx: CanvasRenderingContext2D, opts: RenderOptions) {
  const { w, h, outer, screen, molding } = frameLayout();
  paintScene(ctx, w, h, opts.scene);
  softShadow(ctx, outer.x + outer.w / 2 + 12, outer.y + outer.h - 4, outer.w * 0.4, 22, shadowAlpha(opts.scene));
  ctx.fillStyle = "#241e19";
  ctx.fillRect(outer.x, outer.y, outer.w, outer.h);
  ctx.fillStyle = "#8c6844";
  ctx.fillRect(outer.x + 8, outer.y + 8, outer.w - 16, outer.h - 16);
  ctx.fillStyle = "#1a1613";
  ctx.fillRect(outer.x + 16, outer.y + 16, outer.w - 32, outer.h - 32);
  ctx.fillStyle = "#fffcf7";
  ctx.fillRect(
    outer.x + molding,
    outer.y + molding,
    outer.w - molding * 2,
    outer.h - molding * 2,
  );
  drawArt(ctx, screen, opts.art, opts.quiet);
}

const LAYOUTS: Record<string, Layout> = {
  celular: {
    ...sizeOf(phoneLayout(false)),
    screen: phoneLayout(false).screen,
    draw: (ctx, opts) => drawPhone(ctx, opts, false),
  },
  "celular-horizontal": {
    ...sizeOf(phoneLayout(true)),
    screen: phoneLayout(true).screen,
    draw: (ctx, opts) => drawPhone(ctx, opts, true),
  },
  tableta: {
    ...sizeOf(tabletLayout()),
    screen: tabletLayout().screen,
    draw: drawTablet,
  },
  portatil: {
    ...sizeOf(laptopLayout()),
    screen: laptopLayout().screen,
    draw: drawLaptop,
  },
  monitor: {
    ...sizeOf(monitorLayout()),
    screen: monitorLayout().screen,
    draw: drawMonitor,
  },
  navegador: {
    ...sizeOf(browserLayout()),
    screen: browserLayout().screen,
    draw: drawBrowser,
  },
  poster: {
    ...sizeOf(posterLayout()),
    screen: posterLayout().screen,
    draw: drawPoster,
  },
  tarjeta: {
    ...sizeOf(cardLayout()),
    screen: cardLayout().screen,
    draw: drawCard,
  },
  revista: {
    ...sizeOf(magazineLayout()),
    screen: magazineLayout().screen,
    draw: drawMagazine,
  },
  hoja: {
    ...sizeOf(sheetLayout()),
    screen: sheetLayout().screen,
    draw: drawSheet,
  },
  libro: {
    ...sizeOf(bookLayout()),
    screen: bookLayout().screen,
    draw: drawBook,
  },
  periodico: {
    ...sizeOf(newsLayout()),
    screen: newsLayout().screen,
    draw: drawNews,
  },
  espectacular: {
    ...sizeOf(billboardLayout()),
    screen: billboardLayout().screen,
    draw: drawBillboard,
  },
  marco: {
    ...sizeOf(frameLayout()),
    screen: frameLayout().screen,
    draw: drawFrame,
  },
};

function sizeOf(box: { w: number; h: number }) {
  return { w: box.w, h: box.h };
}

const META: Record<string, Omit<Template, "id" | "w" | "h">> = {
  celular: { name: "Celular", group: "Dispositivos", hardware: true, note: "Marco vertical con isla" },
  "celular-horizontal": {
    name: "Celular horizontal",
    group: "Dispositivos",
    hardware: true,
    note: "El mismo teléfono, de lado",
  },
  tableta: { name: "Tableta", group: "Dispositivos", hardware: true, note: "Bisel fino, vertical" },
  portatil: { name: "Portátil", group: "Dispositivos", hardware: true, note: "Pantalla y teclado" },
  monitor: { name: "Monitor", group: "Dispositivos", hardware: true, note: "Escritorio con base" },
  navegador: { name: "Navegador", group: "Pantalla", hardware: false, note: "Ventana de escritorio" },
  poster: { name: "Póster", group: "Impresión", hardware: false, note: "Hoja con margen y cinta" },
  tarjeta: { name: "Tarjeta", group: "Impresión", hardware: false, note: "Tarjeta sobre mesa" },
  revista: { name: "Revista", group: "Impresión", hardware: false, note: "Página derecha del pliego" },
  hoja: { name: "Hoja", group: "Impresión", hardware: false, note: "Impresión a sangre contenida" },
  libro: { name: "Libro", group: "Impresión", hardware: false, note: "Cubierta con lomo" },
  periodico: { name: "Periódico", group: "Impresión", hardware: false, note: "Portada con foto central" },
  espectacular: { name: "Espectacular", group: "Impresión", hardware: false, note: "Anuncio exterior" },
  marco: { name: "Marco", group: "Impresión", hardware: false, note: "Moldura de galería" },
};

export const TEMPLATES: Template[] = Object.keys(META).map((id) => {
  const layout = LAYOUTS[id];
  if (!layout) throw new Error(`Missing layout ${id}`);
  return { id, w: layout.w, h: layout.h, ...META[id] };
});

export const GROUPS: GroupId[] = ["Dispositivos", "Pantalla", "Impresión"];

export function screenOf(id: string): Rect {
  return LAYOUTS[id]?.screen ?? { x: 0, y: 0, w: 1, h: 1, r: 0 };
}

export function renderMockup(ctx: CanvasRenderingContext2D, id: string, opts: RenderOptions) {
  const layout = LAYOUTS[id];
  if (!layout) return;
  ctx.save();
  layout.draw(ctx, opts);
  ctx.restore();
}

export function templateById(id: string): Template {
  return TEMPLATES.find((item) => item.id === id) ?? TEMPLATES[0]!;
}
