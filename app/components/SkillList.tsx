import { Code, Database, Globe } from "lucide-react";

// ✅ static skills outside the component
const skills = [
  { name: "Python", icon: Code, color: "bg-blue-500/20" },
  { name: "C", icon: Code, color: "bg-blue-500/20" },
  { name: "C++", icon: Code, color: "bg-blue-500/20" },
  { name: "HTML", icon: Code, color: "bg-blue-500/20" },
  { name: "CSS", icon: Code, color: "bg-blue-500/20" },
  { name: "JavaScript", icon: Code, color: "bg-blue-500/20" },
  { name: "SQL", icon: Code, color: "bg-blue-500/20" },
  { name: "NextJS", icon: Globe, color: "bg-pink-500/20" },
  { name: "React", icon: Globe, color: "bg-pink-500/20" },
  { name: "Flutter", icon: Globe, color: "bg-pink-500/20" },
  { name: "PostgreSQL", icon: Database, color: "bg-red-500/20" },
  { name: "Big Query", icon: Database, color: "bg-red-500/20" },
];

export default function SkillsList() {
  return (
    <section>
      {/* 🔹 Skills Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 text-sm">
        {skills.map((skill) => {
          const Icon = skill.icon;
          return (
            <div
              key={skill.name}
              className={`flex flex-col items-center justify-center text-center p-4 rounded-xl shadow-md ${skill.color} hover:scale-105 transition-transform duration-0 will-change-transform`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="font-semibold">{skill.name}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
