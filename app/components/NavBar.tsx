import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-[#0a1f44]/80 backdrop-blur-md shadow-md">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link
          href="/"
          className="text-white text-2xl font-orbitron tracking-wider"
        >
          Tom's Website
        </Link>
        <div className="space-x-6">
          <Link
            href="/"
            className="text-white hover:text-blue-300 text-lg transition"
          >
            Home
          </Link>
          <Link
            href="/about"
            className="text-white hover:text-blue-300 text-lg transition"
          >
            About
          </Link>
        </div>
      </div>
    </nav>
  );
}
