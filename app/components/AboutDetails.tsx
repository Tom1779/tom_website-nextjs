"use client";

import { FileText, Github, Linkedin, Mail } from "lucide-react";
import AboutText from "./AboutText";
import { skills } from "./SkillList";

const links = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/tom-arad/", icon: Linkedin },
  { label: "GitHub", href: "https://github.com/Tom1779", icon: Github },
  { label: "Email", href: "mailto:tom.arad.2001@gmail.com", icon: Mail },
];

/** Bio, skills and contact links shown next to the profile card in the "about me" pop-up. */
export default function AboutDetails({ onResume }: { onResume?: () => void }) {
  return (
    <div className="space-y-6 text-left text-white">
      <div>
        <p className="font-sans text-xs uppercase tracking-[0.3em] text-amber-200/70">About me</p>
        <h2 className="mt-1 text-2xl font-bold sm:text-3xl">Hi, I&apos;m Tom.</h2>
      </div>

      <AboutText className="font-serif" />

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
        <span className="text-sm font-medium text-gray-400">Skills &amp; Expertise</span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
      </div>
      <ul className="flex flex-wrap gap-2 font-sans text-sm">
        {skills.map(({ name, icon: Icon, color }) => (
          <li key={name} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${color}`}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {name}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2 pt-2 font-sans text-sm">
        {links.map(({ label, href, icon: Icon }) => (
          <a
            key={label}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-slate-200 transition hover:bg-white/10"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </a>
        ))}
        {onResume && (
          <button
            type="button"
            onClick={onResume}
            className="inline-flex items-center gap-2 rounded-full border border-amber-200/40 bg-amber-200/10 px-4 py-2 text-amber-100 transition hover:bg-amber-200/20"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            See my résumé
          </button>
        )}
      </div>
    </div>
  );
}
