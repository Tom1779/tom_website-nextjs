"use client";
import React from "react";
import type { ComponentProps, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Linkedin, Github, Mail } from "lucide-react";

interface FooterLink {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const socialLinks: FooterLink[] = [
  {
    title: "LinkedIn",
    href: "https://www.linkedin.com/in/tom-arad/",
    icon: Linkedin,
  },
  { title: "GitHub", href: "https://github.com/Tom1779", icon: Github },
];

export default function Footer() {
  return (
    <footer className="w-full bg-gray-900 text-white border-t border-gray-700">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col items-center space-y-4 sm:space-y-6">
          {/* Social Links */}
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-6">
            <div className="flex space-x-4 sm:space-x-6">
              {socialLinks.map((link) => (
                <a
                  key={link.title}
                  href={link.href}
                  className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors group"
                  target={link.href.startsWith("http") ? "_blank" : undefined}
                  rel={
                    link.href.startsWith("http")
                      ? "noopener noreferrer"
                      : undefined
                  }
                >
                  <link.icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium">{link.title}</span>
                </a>
              ))}
            </div>
            {/* Display email - responsive layout */}
            <div className="flex items-center space-x-2 text-gray-300">
              <Mail className="w-5 h-5" />
              <span className="text-xs sm:text-sm font-medium break-all">
                tom.arad.2001@gmail.com
              </span>
            </div>
          </div>

          {/* Copyright */}
          <p className="text-gray-400 text-xs sm:text-sm text-center px-4">
            © 2025 Tom Arad. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

type AnimatedContainerProps = {
  delay?: number;
  className?: ComponentProps<typeof motion.div>["className"];
  children: ReactNode;
};

function AnimatedContainer({
  className,
  delay = 0.1,
  children,
}: AnimatedContainerProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
