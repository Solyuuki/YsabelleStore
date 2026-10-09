import { memo } from "react";

/** Reusable dark-mode galaxy artwork. Keeps existing proportional geometry. */
export const StorefrontGalaxyArtwork = memo(function StorefrontGalaxyArtwork({
  className
}: {
  className: string;
}) {
  return (
      <svg
        className={className}
        focusable="false"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 1024 1536"
      >
        <defs>
          <radialGradient id="ysCosmicTopNebula">
            <stop offset="0%" stopColor="#4E60B9" stopOpacity="0.34" />
            <stop offset="50%" stopColor="#6D52BA" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#423D89" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ysCosmicLowerNebula">
            <stop offset="0%" stopColor="#8551C1" stopOpacity="0.33" />
            <stop offset="58%" stopColor="#51459C" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#353780" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ysCosmicBlueNebula">
            <stop offset="0%" stopColor="#3B6ABF" stopOpacity="0.23" />
            <stop offset="100%" stopColor="#254486" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="205" cy="155" rx="430" ry="320" fill="url(#ysCosmicTopNebula)" />
        <ellipse cx="240" cy="1325" rx="430" ry="400" fill="url(#ysCosmicLowerNebula)" />
        <ellipse cx="920" cy="1110" rx="250" ry="390" fill="url(#ysCosmicBlueNebula)" />
        {/* Decorative pinpoints are deterministic so the constellation never re-shuffles. */}
        {Array.from({ length: 156 }, (_, index) => {
          const a = (index * 3187 + index * index * 73 + 61) % 1009;
          const b = (index * 2269 + index * index * 131 + 257) % 1531;
          const x = 1024 - (index % 4 === 0 ? 650 + (a % 350) : index % 4 === 1 ? 20 + (a % 970) : index % 4 === 2 ? 750 + (a % 260) : a);
          const y = index % 4 === 0 ? b % 340 : index % 4 === 2 ? 1000 + (b % 530) : b;
          const centerQuiet = x > 255 && x < 845 && y > 310 && y < 1130;
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r={index % 17 === 0 ? 2.25 : index % 7 === 0 ? 1.35 : 0.75}
              fill={index % 3 === 0 ? "#AABFFF" : index % 3 === 1 ? "#C5A6FF" : "#D7E4FF"}
              opacity={centerQuiet ? 0.13 : index % 9 === 0 ? 0.63 : 0.32}
            />
          );
        })}

        <g fill="none" strokeLinecap="round">
          <circle cx="-120" cy="120" r="258" stroke="#A28CEB" strokeOpacity="0.32" strokeWidth="1.1" />
          <circle cx="-120" cy="120" r="327" stroke="#8899EA" strokeOpacity="0.12" strokeWidth="0.9" />
          <circle cx="-110" cy="1415" r="372" stroke="#B18CEB" strokeOpacity="0.39" strokeWidth="1.2" />
          <circle cx="-110" cy="1415" r="455" stroke="#8E7ED4" strokeOpacity="0.15" strokeWidth="0.85" />
        </g>
        <g fill="#A88DE9" opacity="0.66">
          <circle cx="165" cy="210" r="7" />
          <circle cx="240" cy="1278" r="7" />
          <circle cx="248" cy="132" r="3.6" />
          <circle cx="318" cy="1326" r="3.2" />
        </g>
        <g fill="none" stroke="#B3C9FF" strokeLinecap="round" strokeOpacity="0.6">
          <path d="M184 118v16M176 126h16M318 246v12M312 252h12" strokeWidth="1.1" />
          <path d="M158 1362v16M150 1370h16M344 1390v12M338 1396h12" strokeWidth="0.9" />
        </g>
      </svg>
  );
});
