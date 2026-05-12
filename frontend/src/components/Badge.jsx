import React from "react";

const Badge = ({ link = "https://www.linkedin.com/in/mayuresh-tandel-1104dev/" }) => {
  return (
    <>
      <style>{`
        @keyframes badge-shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }

        @keyframes badge-glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(99, 102, 241, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          }
          50% {
            box-shadow: 0 0 30px rgba(99, 102, 241, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15);
          }
        }

        .badge-container {
          position: relative;
          overflow: hidden;
        }

        .badge-container::before {
          content: "none";
          position: absolute;
          top: 0;
          left: -1000px;
          width: 1000px;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.3),
            transparent
          );
          animation: badge-shimmer 3s infinite;
        }

        .badge-container:hover {
          animation: badge-glow 2s ease-in-out infinite;
        }
      `}</style>

      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="badge-container inline-flex items-center justify-center px-2 xs:px-3 sm:px-4 py-1 xs:py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-red-600 via-red-500 to-red-400 hover:from-red-500 hover:via-red-400 hover:to-red-300 text-white font-semibold text-xs tracking-widest shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 border border-red-400/50 hover:border-red-300/80 group"
        aria-label="Connect on LinkedIn"
      >
        <span className="relative z-10 text-xs xs:text-sm sm:text-base font-bold tracking-wider">MT</span>
      </a>
    </>
  );
};

export default Badge;
