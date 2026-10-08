"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CloudRain, Download, FileText, Github, Linkedin } from "lucide-react";
import AboutText from "./AboutText";
import { skills } from "./SkillList";
import { useResumeThumb } from "./rain/ResumeBillboard";

interface SimpleViewProps {
  /** the project grid */
  grid: ReactNode;
  /** the profile card */
  card?: ReactNode;
  projectCount: number;
  resumeUrl?: string;
  /** why the simple view was chosen for this visitor, if it wasn't their own choice */
  notice?: string;
  onResume: () => void;
  onRain: () => void;
}

const pill =
  "inline-flex items-center gap-2 rounded-full border px-4 py-2 font-sans text-sm transition-colors duration-200";

/**
 * The simple portfolio view: shown for reduced motion, no / unverifiable hardware acceleration, or when
 * chosen. Everything here is static (gradients painted once, no blur or backdrop-filter, no endless
 * animations) so it stays smooth without a GPU.
 */
export default function SimpleView({ grid, card, projectCount, resumeUrl, notice, onResume, onRain }: SimpleViewProps) {
  const thumb = useResumeThumb(resumeUrl ?? "");
  const thumbSrc = useMemo(() => (thumb ? thumb.toDataURL("image/png") : null), [thumb]);
  const [backdrop, setBackdrop] = useState<{ glow: string; dots: string } | null>(null);
  useEffect(() => setBackdrop(paintBackdrop()), []);

  return (
    <div className="relative w-full overflow-hidden text-white">
      {/* backdrop: deep navy to plum, a few soft colour glows and a faint dot grid, baked into small images
          once and pinned to the screen. (Live CSS gradients get re-drawn every frame by Firefox's software
          renderer, which made scrolling stutter without hardware acceleration.) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundColor: "#0d1430",
          backgroundImage: backdrop ? `url(${backdrop.dots}), url(${backdrop.glow})` : undefined,
          backgroundSize: "26px 26px, 100% 100%",
          backgroundRepeat: "repeat, no-repeat",
        }}
      />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-24 px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
        {/* ---- hero ---- */}
        <section className="grid items-center gap-12 lg:grid-cols-[1fr_auto]">
          <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
            <p className="font-sans text-xs uppercase tracking-[0.35em] text-teal-300/80">Software Engineer</p>
            <h1 className="text-5xl font-bold leading-[1.05] sm:text-7xl">
              Tom{" "}
              <span className="bg-gradient-to-r from-teal-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">
                Arad
              </span>
            </h1>
            <p className="max-w-xl font-sans text-base leading-relaxed text-slate-300 sm:text-lg">
              I build things for the web, and I&apos;m driven by curiosity for data science and machine learning. Below
              are a few of the projects I&apos;ve made.
            </p>
            <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
              {resumeUrl && (
                <button
                  type="button"
                  onClick={onResume}
                  className={`${pill} border-amber-200/50 bg-amber-200/15 text-amber-50 hover:bg-amber-200/25`}
                >
                  <FileText className="h-4 w-4" aria-hidden="true" /> Résumé
                </button>
              )}
              <a
                href="https://www.linkedin.com/in/tom-arad/"
                target="_blank"
                rel="noopener noreferrer"
                className={`${pill} border-white/15 bg-white/5 text-slate-200 hover:bg-white/10`}
              >
                <Linkedin className="h-4 w-4" aria-hidden="true" /> LinkedIn
              </a>
              <a
                href="https://github.com/Tom1779"
                target="_blank"
                rel="noopener noreferrer"
                className={`${pill} border-white/15 bg-white/5 text-slate-200 hover:bg-white/10`}
              >
                <Github className="h-4 w-4" aria-hidden="true" /> GitHub
              </a>
              <button
                type="button"
                onClick={onRain}
                className={`${pill} border-sky-300/30 text-sky-100 hover:border-sky-300/60 hover:bg-sky-300/10`}
              >
                <CloudRain className="h-4 w-4" aria-hidden="true" /> See the rain
              </button>
            </div>
            {notice && (
              <p role="status" className="max-w-md font-sans text-xs leading-relaxed text-slate-400">
                {notice}
              </p>
            )}
          </div>
          {card && <div className="flex justify-center max-sm:[zoom:0.85]">{card}</div>}
        </section>

        {/* ---- projects ---- */}
        <section aria-labelledby="projects-title" className="flex flex-col gap-8">
          <SectionHeading id="projects-title" eyebrow={`${projectCount} projects`} title="Things I've built" />
          {grid}
        </section>

        {/* ---- about ---- */}
        <section aria-labelledby="about-title" className="flex flex-col gap-8">
          <SectionHeading id="about-title" eyebrow="About" title="A bit about me" />
          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 sm:p-9">
              <AboutText className="font-serif" />
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 sm:p-9">
              <p className="mb-5 font-sans text-xs uppercase tracking-[0.3em] text-slate-400">Skills &amp; tools</p>
              <ul className="flex flex-wrap gap-2 font-sans text-sm">
                {skills.map(({ name, icon: Icon, color }) => (
                  <li key={name} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${color}`}>
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---- résumé ---- */}
        {resumeUrl && (
          <section aria-labelledby="resume-title" className="flex flex-col gap-8">
            <SectionHeading id="resume-title" eyebrow="Résumé" title="Experience at a glance" />
            <div className="grid items-center gap-10 rounded-3xl border border-white/10 bg-white/[0.035] p-7 sm:p-10 md:grid-cols-[auto_1fr]">
              <button
                type="button"
                onClick={onResume}
                aria-label="Open Tom's résumé"
                className="group mx-auto block w-56 -rotate-2 overflow-hidden rounded-md bg-[#e9e4d8] shadow-[0_18px_40px_rgba(0,0,0,0.55)] transition-transform duration-300 hover:rotate-0 hover:scale-[1.02] sm:w-64"
                style={{ aspectRatio: "8.5 / 11" }}
              >
                {thumbSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbSrc} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="flex h-full items-center justify-center font-serif text-slate-500">Résumé</span>
                )}
              </button>
              <div className="flex flex-col items-center gap-5 text-center md:items-start md:text-left">
                <p className="max-w-md font-sans leading-relaxed text-slate-300">
                  Education, experience, projects and skills on one page. Open it here, or grab a copy.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={onResume}
                    className={`${pill} border-amber-200/50 bg-amber-200/15 text-amber-50 hover:bg-amber-200/25`}
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" /> Read it
                  </button>
                  <a
                    href={`/${resumeUrl}`}
                    download
                    className={`${pill} border-white/15 bg-white/5 text-slate-200 hover:bg-white/10`}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" /> Download PDF
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/** Paint the backdrop's glows and dot tile into small images (stretched / tiled by CSS). */
function paintBackdrop() {
  const W = 480;
  const H = 300;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#0a1124");
  base.addColorStop(0.5, "#0e1433");
  base.addColorStop(1, "#121032");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  // soft elliptical glows: [centre x, centre y, radius x, radius y] as fractions of the screen, colour
  const glows: [number, number, number, number, string][] = [
    [0.1, 0.0, 0.62, 0.6, "45,212,191,0.16"],
    [1.0, 0.35, 0.5, 0.66, "139,92,246,0.17"],
    [0.0, 0.9, 0.58, 0.6, "59,130,246,0.12"],
    [0.95, 1.1, 0.52, 0.56, "251,191,36,0.09"],
  ];
  for (const [x, y, rx, ry, rgba] of glows) {
    ctx.save();
    ctx.translate(x * W, y * H);
    ctx.scale((rx * W) / (ry * H), 1);
    const r = ry * H;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(${rgba})`);
    g.addColorStop(1, `rgba(${rgba.replace(/[^,]+$/, "0")})`);
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }
  const d = document.createElement("canvas");
  d.width = d.height = 26;
  const dx = d.getContext("2d")!;
  dx.fillStyle = "rgba(255,255,255,0.05)";
  dx.beginPath();
  dx.arc(13, 13, 1.1, 0, Math.PI * 2);
  dx.fill();
  return { glow: c.toDataURL("image/png"), dots: d.toDataURL("image/png") };
}

function SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
      <p className="font-sans text-xs uppercase tracking-[0.35em] text-teal-300/80">{eyebrow}</p>
      <h2 id={id} className="text-3xl font-bold sm:text-4xl">
        {title}
      </h2>
      <div className="mt-1 h-1 w-16 rounded-full bg-gradient-to-r from-teal-300 to-violet-400" />
    </div>
  );
}
