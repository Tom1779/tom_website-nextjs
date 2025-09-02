import Image from "next/image";
import SkillsList from "../components/SkillList";

export default function About() {
  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8 text-white font-serif">
      <div className="max-w-6xl mx-auto">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            About Me
          </h1>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto rounded-full"></div>
        </div>

        {/* Main content card */}
        <div className="bg-neutral-900/60 backdrop-blur-sm p-8 lg:p-12 rounded-3xl shadow-2xl border border-neutral-800/50">
          {/* Flex layout */}
          <div className="flex flex-col lg:flex-row items-start gap-12">
            {/* Image section */}
            <div className="lg:w-1/3 flex-shrink-0">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
                <Image
                  src="/Me.jpg"
                  alt="Me"
                  width={400}
                  height={400}
                  priority
                  className="relative w-full h-auto rounded-2xl object-cover shadow-lg"
                />
              </div>
            </div>

            {/* Text content */}
            <div className="lg:w-2/3 space-y-8">
              <div className="space-y-6">
                <p className="text-lg font-medium leading-relaxed text-gray-100">
                  Welcome! This website serves as a window into my professional
                  journey. Here, you'll find a look into my background,
                  interests, and passions. As a Software Engineer, I am driven
                  by curiosity and a love for solving problems in web
                  development, data science, and machine learning.
                </p>

                <p className="text-base leading-relaxed text-gray-300">
                  Outside of my professional pursuits, I enjoy staying active
                  and engaged through basketball, soccer, and regular gym
                  sessions. I also sharpen my problem-solving skills with coding
                  challenges and enjoy relaxing with video games in my downtime.
                  These hobbies keep me balanced and continue to fuel my
                  creativity and discipline.
                </p>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
                <span className="text-sm text-gray-400 font-medium">
                  Skills & Expertise
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
              </div>

              {/* Skills Section */}
              <section className="pt-4">
                <SkillsList />
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
