import { useCallback, useEffect, useRef, useState } from "react";
import { PhoneStage, type PhoneStageHandle } from "@/components/phone-stage";
import { DEFAULT_POSE, drawPhoneThumb, type PhonePose } from "@/lib/phone-view";
import { Download, RotateCcw, Upload } from "lucide-react";
import {
  GROUPS,
  TEMPLATES,
  renderMockup,
  screenOf,
  templateById,
  type FinishId,
  type FitMode,
  type GroupId,
  type SceneId,
} from "@/lib/render-mockup";

const SCENES: { id: SceneId; label: string }[] = [
  { id: "papel", label: "Papel" },
  { id: "estudio", label: "Estudio" },
  { id: "tinta", label: "Tinta" },
  { id: "blanco", label: "Blanco" },
];

const FINISHES: { id: FinishId; label: string }[] = [
  { id: "grafito", label: "Grafito" },
  { id: "plata", label: "Plata" },
  { id: "arena", label: "Arena" },
];

const SAMPLES = [
  { id: "patio", name: "Patio", src: "/samples/patio.jpg" },
  { id: "bodegon", name: "Bodegón", src: "/samples/bodegon.jpg" },
  { id: "muro", name: "Muro", src: "/samples/muro.jpg" },
  { id: "campo", name: "Campo", src: "/samples/campo.jpg" },
];

export function Studio() {
  const [templateId, setTemplateId] = useState(TEMPLATES[0]!.id);
  const [section, setSection] = useState<GroupId>(TEMPLATES[0]!.group);
  const [scene, setScene] = useState<SceneId>("papel");
  const [finish, setFinish] = useState<FinishId>("grafito");
  const [fit, setFit] = useState<FitMode>("cover");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [pose, setPose] = useState<PhonePose>(DEFAULT_POSE);
  const [poseRev, setPoseRev] = useState(0);
  const [viewMode, setViewMode] = useState<"girar" | "encuadrar">("girar");
  const [cut, setCut] = useState(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageName, setImageName] = useState("Patio");
  const [sampleId, setSampleId] = useState<string | null>("patio");
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState<null | "escena" | "corte">(null);
  const [fontTick, setFontTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const thumbs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const phoneRef = useRef<PhoneStageHandle>(null);
  const gesture = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const template = templateById(templateId);

  const fitCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const current = templateById(templateId);
    const pad = 28;
    const availW = Math.max(1, stage.clientWidth - pad);
    const availH = Math.max(1, stage.clientHeight - pad);
    const scale = Math.min(availW / current.w, availH / current.h);
    canvas.style.width = `${Math.max(1, Math.floor(current.w * scale))}px`;
    canvas.style.height = `${Math.max(1, Math.floor(current.h * scale))}px`;
  }, [templateId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = templateById(templateId);
    canvas.width = current.w;
    canvas.height = current.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderMockup(ctx, current.id, {
      scene,
      finish,
      transparent: cut,
      art: { image, zoom, panX: pan.x, panY: pan.y, fit },
    });
    fitCanvas();
  }, [templateId, scene, finish, zoom, pan, image, fit, cut, fontTick, fitCanvas]);

  useEffect(() => {
    for (const item of TEMPLATES) {
      const thumb = thumbs.current[item.id];
      if (!thumb) continue;
      if (item.dimensional) {
        const ctx = thumb.getContext("2d");
        if (!ctx) continue;
        thumb.width = 180;
        thumb.height = 220;
        drawPhoneThumb(ctx, item.id, finish, image);
        continue;
      }
      const scale = 200 / item.w;
      thumb.width = Math.max(1, Math.round(item.w * scale));
      thumb.height = Math.max(1, Math.round(item.h * scale));
      const ctx = thumb.getContext("2d");
      if (!ctx) continue;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      renderMockup(ctx, item.id, {
        scene,
        finish,
        quiet: true,
        art: { image, zoom: 1, panX: 0, panY: 0, fit: "cover" },
      });
    }
  }, [image, scene, finish, fontTick]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => fitCanvas());
    observer.observe(stage);
    return () => observer.disconnect();
  }, [fitCanvas]);

  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) setFontTick((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.94 : 1.06;
      setZoom((value) => Math.min(4, Math.max(0.35, value * factor)));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [templateId]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = "/samples/patio.jpg";
  }, []);

  function resetFrame() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function chooseTemplate(id: string) {
    const next = templateById(id);
    setTemplateId(next.id);
    setSection(next.group);
    resetFrame();
  }

  function chooseSection(group: GroupId) {
    setSection(group);
    if (template.group === group) return;
    const first = TEMPLATES.find((item) => item.group === group);
    if (!first) return;
    setTemplateId(first.id);
    resetFrame();
  }

  function useSample(id: string, src: string, name: string) {
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setImageName(name);
      setSampleId(id);
      setError("");
      resetFrame();
    };
    img.onerror = () => setError("No pude abrir esa muestra.");
    img.src = src;
  }

  function useFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Ese archivo no es una imagen.");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setImageName(file.name);
      setSampleId(null);
      setError("");
      resetFrame();
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("No pude leer esa imagen. Prueba con JPG o PNG.");
    };
    img.src = url;
  }

  async function download(transparent: boolean) {
    if (!image) return;
    const current = templateById(templateId);
    const blob = current.dimensional
      ? await phoneRef.current?.capture(transparent)
      : await new Promise<Blob | null>((resolve) => {
          const exportCanvas = document.createElement("canvas");
          exportCanvas.width = current.w;
          exportCanvas.height = current.h;
          const ctx = exportCanvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }
          renderMockup(ctx, current.id, {
            scene,
            finish,
            transparent,
            art: { image, zoom, panX: pan.x, panY: pan.y, fit },
          });
          exportCanvas.toBlob((value) => resolve(value), "image/png");
        });
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = transparent ? `mesa-${current.id}-sin-fondo.png` : `mesa-${current.id}.png`;
    link.click();
    URL.revokeObjectURL(url);
    setSaved(transparent ? "corte" : "escena");
    window.setTimeout(() => setSaved(null), 1600);
  }

  function aim(partial: Partial<PhonePose>) {
    setPose((prev) => ({ ...prev, ...partial }));
    setPoseRev((n) => n + 1);
  }

  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const sx = canvas.width / bounds.width;
    const sy = canvas.height / bounds.height;
    const x = (event.clientX - bounds.left) * sx;
    const y = (event.clientY - bounds.top) * sy;
    const screen = screenOf(templateId);
    const inside =
      x >= screen.x && y >= screen.y && x <= screen.x + screen.w && y <= screen.y + screen.h;
    if (!inside) return;
    canvas.setPointerCapture(event.pointerId);
    gesture.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
  }

  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const current = gesture.current;
    if (!canvas || !current) return;
    const bounds = canvas.getBoundingClientRect();
    const sx = canvas.width / bounds.width;
    const sy = canvas.height / bounds.height;
    setPan({
      x: current.panX + (event.clientX - current.x) * sx,
      y: current.panY + (event.clientY - current.y) * sy,
    });
  }

  function pointerUp() {
    gesture.current = null;
  }

  return (
    <div className="studio">
      <header className="head flex items-center justify-between gap-3 border-b border-rule bg-sheet px-4 py-3">
        <div className="min-w-0">
          <h1 className="mark text-3xl text-ink">Mesa</h1>
          <p className="truncate text-sm text-mute">Sección, modelo y PNG.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn" onClick={() => download(true)} disabled={!image}>
            {saved === "corte" ? "Listo" : "Sin fondo"}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => download(false)} disabled={!image}>
            <Download className="size-4" aria-hidden="true" />
            {saved === "escena" ? "Listo" : "Descargar"}
          </button>
        </div>
      </header>

      <nav className="catalog" aria-label="Marcos">
        <div className="section-tabs" role="tablist" aria-label="Secciones">
          {GROUPS.map((group) => (
            <button
              key={group}
              type="button"
              role="tab"
              aria-selected={section === group}
              onClick={() => chooseSection(group)}
            >
              {group}
            </button>
          ))}
        </div>
        {GROUPS.map((group) => (
          <div className={section === group ? "group group-open" : "group"} key={group}>
            <p className="group-label">{group}</p>
            <div className="group-items">
              {TEMPLATES.filter((item) => item.group === group).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === templateId ? "item item-on" : "item"}
                  aria-pressed={item.id === templateId}
                  onClick={() => chooseTemplate(item.id)}
                >
                  <canvas
                    className="thumb"
                    ref={(node) => {
                      thumbs.current[item.id] = node;
                    }}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{item.name}</strong>
                    <em>{item.dimensional ? "Gira y acerca" : "Modelo"}</em>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div
        className={over ? "stage is-over" : "stage"}
        ref={stageRef}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const file = event.dataTransfer.files[0];
          if (file) useFile(file);
        }}
      >
        {template.dimensional ? (
          <PhoneStage
            ref={phoneRef}
            modelId={template.id}
            finish={finish}
            scene={scene}
            cut={cut}
            image={image}
            fit={fit}
            zoom={zoom}
            pan={pan}
            pose={pose}
            poseRev={poseRev}
            mode={viewMode}
            onPose={setPose}
            onFrame={(frame) => {
              setPan(frame.pan);
              setZoom(frame.zoom);
            }}
            className={cut ? "is-cut" : undefined}
          />
        ) : (
          <canvas
            ref={canvasRef}
            role="img"
            className={cut ? "is-cut" : undefined}
            aria-label={`Mockup ${template.name}`}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
            onDoubleClick={resetFrame}
          />
        )}
      </div>

      <aside className="inspector">
        <div className="span-2">
          <span className="field-label">Imagen</span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" aria-hidden="true" />
              Subir
            </button>
            <button type="button" className="btn" onClick={resetFrame}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Encajar
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) useFile(file);
              event.target.value = "";
            }}
          />
          <p className="mt-2 truncate text-sm text-mute">{error || imageName}</p>
        </div>

        <div className="span-2">
          <span className="field-label">Muestras</span>
          <div className="samples">
            {SAMPLES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                className={sampleId === sample.id ? "sample sample-on" : "sample"}
                aria-pressed={sampleId === sample.id}
                aria-label={sample.name}
                onClick={() => useSample(sample.id, sample.src, sample.name)}
              >
                <img src={sample.src} alt="" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="field-label">Encaje</span>
          <div className="segment" role="group" aria-label="Encaje">
            <button type="button" aria-pressed={fit === "cover"} onClick={() => setFit("cover")}>
              Cubrir
            </button>
            <button type="button" aria-pressed={fit === "contain"} onClick={() => setFit("contain")}>
              Contener
            </button>
          </div>
        </div>

        <div>
          <span className="field-label">
            Zoom <span className="tabular-nums">{Math.round(zoom * 100)}</span>
          </span>
          <input
            type="range"
            min={35}
            max={400}
            value={Math.round(zoom * 100)}
            aria-label="Zoom"
            onChange={(event) => setZoom(Number(event.target.value) / 100)}
          />
        </div>

        <div className="span-2">
          <span className="field-label">Escena</span>
          <div className="chips" role="group" aria-label="Escena">
            {SCENES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="chip"
                aria-pressed={scene === item.id}
                onClick={() => setScene(item.id)}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              className="chip"
              aria-pressed={cut}
              onClick={() => setCut((value) => !value)}
            >
              Ver sin fondo
            </button>
          </div>
        </div>

        {template.hardware ? (
          <div className="span-2">
            <span className="field-label">Acabado</span>
            <div className="chips" role="group" aria-label="Acabado">
              {FINISHES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="chip"
                  aria-pressed={finish === item.id}
                  onClick={() => setFinish(item.id)}
                >
                  <span className={`swatch swatch-${item.id}`} aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {template.dimensional ? (
          <div className="span-2">
            <span className="field-label">Teléfono</span>
            <div className="segment" role="group" aria-label="Modo del teléfono">
              <button type="button" aria-pressed={viewMode === "girar"} onClick={() => setViewMode("girar")}>
                Girar
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "encuadrar"}
                onClick={() => setViewMode("encuadrar")}
              >
                Encuadrar
              </button>
            </div>
            <div className="chips mt-3" role="group" aria-label="Vistas">
              <button type="button" className="chip" onClick={() => aim(DEFAULT_POSE)}>
                Ángulo
              </button>
              <button type="button" className="chip" onClick={() => aim({ yaw: 0, pitch: 0, closeness: 0.34, fov: 26 })}>
                Frente
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => aim({ yaw: 180, pitch: 16, closeness: 0.4, fov: 32 })}
              >
                Espalda
              </button>
              <button type="button" className="chip" onClick={() => aim({ closeness: 0.86, fov: 22 })}>
                Acercar
              </button>
            </div>
            <span className="field-label mt-3">
              Giro <span className="tabular-nums">{Math.round(pose.yaw)}°</span>
            </span>
            <input
              type="range"
              min={-180}
              max={180}
              value={Math.round(pose.yaw)}
              aria-label="Giro"
              onChange={(event) => aim({ yaw: Number(event.target.value) })}
            />
            <span className="field-label mt-3">
              Inclinación <span className="tabular-nums">{Math.round(pose.pitch)}°</span>
            </span>
            <input
              type="range"
              min={-70}
              max={70}
              value={Math.round(pose.pitch)}
              aria-label="Inclinación"
              onChange={(event) => aim({ pitch: Number(event.target.value) })}
            />
            <span className="field-label mt-3">
              Acercar <span className="tabular-nums">{Math.round(pose.closeness * 100)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(pose.closeness * 100)}
              aria-label="Acercar el teléfono"
              onChange={(event) => aim({ closeness: Number(event.target.value) / 100 })}
            />
            <span className="field-label mt-3">
              Perspectiva <span className="tabular-nums">{Math.round(pose.fov)}°</span>
            </span>
            <input
              type="range"
              min={18}
              max={62}
              value={Math.round(pose.fov)}
              aria-label="Perspectiva"
              onChange={(event) => aim({ fov: Number(event.target.value) })}
            />
          </div>
        ) : null}

        <p className="span-2 text-sm text-mute">
          {template.note}.{" "}
          {template.dimensional
            ? "Arrastra para girar el marco. La rueda o el pellizco lo acercan. Encuadrar mueve la foto dentro del cristal."
            : "Arrastra dentro del marco para encuadrar. La rueda hace zoom."}{" "}
          Descarga el PNG con la escena o sin fondo.
        </p>
      </aside>
    </div>
  );
}
