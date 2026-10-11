export function CategoryRetailBackdrop() {
  return (
    <div aria-hidden="true" className="home-categories__backdrop">
      <div className="home-categories__center-light" />

      {/* Dark-mode-only vector ornaments. Geometry stays sharp at every viewport size. */}
      <svg
        className="home-categories__dark-ornament"
        focusable="false"
        preserveAspectRatio="xMidYMin meet"
        viewBox="0 0 1600 900"
      >
        <defs>
          <linearGradient id="categoryDarkBlueStroke" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#75A9F4" stopOpacity="0.3" />
            <stop offset="65%" stopColor="#5884DA" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#637FDB" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="categoryDarkVioletStroke" x1="1" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#C084F6" stopOpacity="0.55" />
            <stop offset="75%" stopColor="#8669D4" stopOpacity="0.46" />
            <stop offset="100%" stopColor="#735DCE" stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id="categoryDarkBottomStroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#5991E2" stopOpacity="0.36" />
            <stop offset="55%" stopColor="#6374DC" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#BD76E7" stopOpacity="0.48" />
          </linearGradient>
        </defs>
        <g fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke">
          <path
            d="M-85 322C164 274 281 117 334 -82"
            stroke="url(#categoryDarkBlueStroke)"
            strokeWidth="1.5"
          />
          <path
            d="M-108 366C178 288 312 104 368 -84"
            stroke="#709EE9"
            strokeOpacity="0.11"
            strokeWidth="1"
          />
          <path
            d="M1700 288C1508 354 1390 485 1366 846"
            stroke="url(#categoryDarkVioletStroke)"
            strokeWidth="1.5"
          />
          <path
            d="M1740 339C1512 405 1455 531 1437 864"
            stroke="#AC8BE7"
            strokeOpacity="0.12"
            strokeWidth="1"
          />
          <path
            d="M-80 700C228 724 428 839 806 829C1129 818 1364 760 1680 686"
            stroke="url(#categoryDarkBottomStroke)"
            strokeWidth="1.5"
          />
          <path
            d="M-70 742C239 784 495 872 822 865C1137 856 1442 785 1670 733"
            stroke="#8092E6"
            strokeOpacity="0.09"
            strokeWidth="1"
          />
        </g>
        <g>
          <circle cx="302" cy="177" r="6" fill="#95A3FF" fillOpacity="0.62" />
          <circle cx="198" cy="245" r="4" fill="#618CE9" fillOpacity="0.28" />
          <circle cx="111" cy="305" r="4" fill="#739FFF" fillOpacity="0.46" />
          <circle cx="1494" cy="279" r="6" fill="#AE78EE" fillOpacity="0.62" />
          <circle cx="1425" cy="345" r="4" fill="#926BE0" fillOpacity="0.28" />
        </g>
      </svg>

      <svg
        className="home-categories__portal-scene"
        focusable="false"
        preserveAspectRatio="none"
        viewBox="0 0 1600 900"
      >
        <defs>
          <linearGradient id="categoryPortalBlue" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--category-portal-blue)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--category-portal-indigo)" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="categoryPortalViolet" x1="1" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--category-portal-violet)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--category-portal-indigo)" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="categoryHandoff" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#7fc7ff" stopOpacity="0.16" />
            <stop offset="48%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#c89cff" stopOpacity="0.16" />
          </linearGradient>
          <radialGradient id="categoryPortalGlowBlue" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--category-portal-blue)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--category-portal-blue)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="categoryPortalGlowViolet" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--category-portal-violet)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--category-portal-violet)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g className="home-categories__portal-glows">
          <ellipse cx="110" cy="226" fill="url(#categoryPortalGlowBlue)" rx="330" ry="310" />
          <ellipse cx="1490" cy="234" fill="url(#categoryPortalGlowViolet)" rx="350" ry="320" />
        </g>

        <g className="home-categories__portal-ceiling">
          <path d="M-120 122C258 -26 554 -10 798 86C1046 -10 1346 -22 1720 126" />
          <path
            className="home-categories__portal-line--soft"
            d="M-108 168C272 34 548 38 800 122C1056 34 1338 28 1706 170"
          />
          <path
            className="home-categories__portal-line--inner"
            d="M92 96C330 20 568 24 800 104C1034 24 1268 20 1508 98"
          />
        </g>

        <g className="home-categories__portal-side home-categories__portal-side--left">
          <path d="M-54 80C112 116 214 230 232 378C242 486 214 592 150 690" />
          <path
            className="home-categories__portal-line--soft"
            d="M-14 108C126 142 198 246 206 380C214 478 190 568 134 654"
          />
          <path
            className="home-categories__portal-fill"
            d="M-80 58C106 94 248 224 262 382C274 520 230 650 124 760L0 804H-80Z"
            fill="url(#categoryPortalBlue)"
          />
        </g>

        <g className="home-categories__portal-side home-categories__portal-side--right">
          <path d="M1654 82C1486 116 1382 232 1366 380C1354 490 1384 594 1448 692" />
          <path
            className="home-categories__portal-line--soft"
            d="M1614 110C1472 144 1400 250 1392 382C1386 482 1410 570 1466 658"
          />
          <path
            className="home-categories__portal-fill"
            d="M1680 60C1494 96 1350 226 1338 384C1326 522 1370 654 1478 762L1600 806H1680Z"
            fill="url(#categoryPortalViolet)"
          />
        </g>

        <g className="home-categories__portal-sparkles">
          <circle cx="118" cy="248" r="8" />
          <circle cx="270" cy="138" r="6" />
          <circle cx="1334" cy="142" r="6" />
          <circle cx="1482" cy="250" r="8" />
        </g>

        <g className="home-categories__handoff">
          <path
            d="M0 730C256 674 492 686 734 742C1010 806 1284 796 1600 718V900H0Z"
            fill="url(#categoryHandoff)"
          />
          <path
            d="M0 794C288 738 548 750 806 806C1060 860 1320 850 1600 782V900H0Z"
            fill="#eef7ff"
            opacity="0.46"
          />
          <path
            className="home-categories__handoff-highlight"
            d="M0 758C282 706 530 718 786 772C1040 826 1306 816 1600 744"
          />
        </g>
      </svg>
    </div>
  );
}
