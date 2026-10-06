/** Tom's bio, shared by the About page and the "about me" pop-up on the home page. */
export default function AboutText({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-6 ${className}`}>
      <p className="text-lg font-medium leading-relaxed text-gray-100">
        Welcome! This website serves as a window into my professional journey. Here, you&apos;ll find a look into my
        background, interests, and passions. As a Software Engineer, I am driven by curiosity and a love for solving
        problems in web development, data science, and machine learning.
      </p>

      <p className="text-base leading-relaxed text-gray-300">
        Outside of my professional pursuits, I enjoy staying active and engaged through basketball, soccer, and regular
        gym sessions. I also sharpen my problem-solving skills with coding challenges and enjoy relaxing with video
        games in my downtime. These hobbies keep me balanced and continue to fuel my creativity and discipline.
      </p>
    </div>
  );
}
