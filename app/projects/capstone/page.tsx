"use client";

import Image from "next/image";
import Link from "next/link";

const features = [
  {
    title: "Post Creation & Image Uploads",
    description:
      "Users can create engaging posts accompanied by relevant images, fostering community interaction among alumni. The home page displays a live feed of all posts.",
    image: "/cobb_post.jpg",
    imageAlt: "Post creation feature screenshot",
  },
  {
    title: "User Authentication",
    description:
      "A secure sign-up and login flow stores user information in the backend. Future additions include email verification, profile settings, and account deletion.",
    image: "/cobb_auth.png",
    imageAlt: "Authentication screen screenshot",
  },
  {
    title: "Location Visualization",
    description:
      "Using Firebase, Flutter, and the Google Maps API, an interactive map showcases alumni locations by city — enhancing networking opportunities across geographic regions.",
    image: "/cobb_map.png",
    imageAlt: "Alumni location map screenshot",
  },
  {
    title: "Messaging System",
    description:
      "A private messaging feature lets users communicate directly, encouraging mentoring relationships and the sharing of valuable insights between alumni and students.",
    image: "/cobb_message.jpg",
    imageAlt: "Messaging feature screenshot",
  },
];

const techStack = [
  { label: "Flutter", description: "Cross-platform UI framework" },
  { label: "Firebase", description: "Auth, database & storage" },
  { label: "Google Maps API", description: "Location visualization" },
  { label: "Dart", description: "Primary language" },
];

export default function CapstoneProjectPage() {
  return (
    <main className="relative z-0 text-white min-h-screen">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-20 pb-16 max-w-4xl mx-auto">
        <span className="text-amber-300 text-sm font-medium tracking-widest uppercase mb-4">
          Capstone Project · Granger Cobb Institute
        </span>
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
          Collaborative Alumni Website
        </h1>
        <p className="text-gray-300 text-lg leading-relaxed max-w-2xl">
          A full-stack web app connecting alumni and students through social
          feeds, direct messaging, and an interactive location map — built with
          Flutter and Firebase.
        </p>

        <div className="flex gap-4 mt-8 flex-wrap justify-center">
          <Link
            href="/"
            className="px-5 py-2.5 border border-gray-600 hover:border-amber-300 text-gray-300 hover:text-amber-300 rounded-lg text-sm transition-colors duration-200"
          >
            ← Back to Projects
          </Link>
        </div>
      </section>

      {/* Divider */}
      <div className="w-full max-w-4xl mx-auto px-6">
        <div className="border-t border-gray-700" />
      </div>

      {/* Introduction */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-amber-300 text-xs font-semibold tracking-widest uppercase mb-4">
          Introduction
        </h2>
        <p className="text-gray-300 text-base leading-relaxed mb-4">
          Capstone projects serve as a bridge between academic learning and
          real world application. Working with the Granger Cobb Institute for
          Senior Living, our three-person team set out to build a comprehensive
          platform that would connect alumni and current students.
        </p>
        <p className="text-gray-300 text-base leading-relaxed">
          The goals were clear: seamless messaging, post creation with image
          uploads, and a map displaying alumni locations by city. What followed
          was an intensive, rewarding development cycle that sharpened both my
          front-end and back-end skills.
        </p>
      </section>

      {/* Video Demo */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <video
          src="/cobb-connect.mp4"
          controls
          className="w-full rounded-2xl border border-white/10"
        />
      </section>

      {/* Divider */}
      <div className="w-full max-w-4xl mx-auto px-6">
        <div className="border-t border-gray-700" />
      </div>

      {/* Tech Stack */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-amber-300 text-xs font-semibold tracking-widest uppercase mb-6">
          Tools & Technologies
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {techStack.map((tech) => (
            <div
              key={tech.label}
              className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-amber-300/40 transition-colors duration-200"
            >
              <p className="text-white font-semibold text-sm mb-1">
                {tech.label}
              </p>
              <p className="text-gray-400 text-xs">{tech.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="w-full max-w-4xl mx-auto px-6">
        <div className="border-t border-gray-700" />
      </div>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-amber-300 text-xs font-semibold tracking-widest uppercase mb-12">
          Features Implemented
        </h2>

        <div className="flex flex-col gap-20">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`flex flex-col md:flex-row gap-8 items-center ${
                i % 2 === 1 ? "md:flex-row-reverse" : ""
              }`}
            >
              {/* Image */}
              <div className="w-full md:w-1/2 rounded-2xl overflow-hidden border border-white/10">
                <Image
                  src={feature.image}
                  alt={feature.imageAlt}
                  width={700}
                  height={450}
                  className="w-full h-auto object-cover"
                />
              </div>

              {/* Text */}
              <div className="w-full md:w-1/2">
                <h3 className="text-white text-xl font-semibold mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-400 text-base leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="w-full max-w-4xl mx-auto px-6">
        <div className="border-t border-gray-700" />
      </div>

      {/* My Contributions */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-amber-300 text-xs font-semibold tracking-widest uppercase mb-4">
          My Contributions
        </h2>
        <p className="text-gray-300 text-base leading-relaxed mb-4">
          I worked across both front-end and back-end components throughout the
          project. My primary focus was crafting the home page, featuring the
          dynamic post feed, and the analytics page, where the alumni map
          visualization lived.
        </p>
        <p className="text-gray-300 text-base leading-relaxed">
          This dual role strengthened my skills in UI design and Firebase
          integration simultaneously, and gave me a deep appreciation for
          building cohesive, user-facing features end-to-end.
        </p>
      </section>

      {/* Conclusion */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-amber-300 text-xs font-semibold tracking-widest uppercase mb-4">
          Conclusion
        </h2>
        <p className="text-gray-300 text-base leading-relaxed">
          Collaborating with the Granger Cobb Institute was an invaluable
          experience, from conceptualization through implementation. Flutter and
          Firebase proved to be a powerful combination, and the project pushed me
          to grow as both a designer and an engineer. While there is still work
          to be done, the progress reflects the dedication of everyone on the
          team.
        </p>
      </section>

      {/* Footer nav */}
      <div className="flex justify-center pb-16">
        <Link
          href="/"
          className="px-5 py-2.5 border border-gray-600 hover:border-amber-300 text-gray-300 hover:text-amber-300 rounded-lg text-sm transition-colors duration-200"
        >
          ← Back to Projects
        </Link>
      </div>
    </main>
  );
}