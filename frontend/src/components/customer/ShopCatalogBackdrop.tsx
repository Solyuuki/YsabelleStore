export function ShopCatalogBackdrop() {
  return (
    <div aria-hidden="true" className="customer-shop-catalog-backdrop">
      <svg
        className="customer-shop-catalog-wave customer-shop-catalog-wave--top"
        focusable="false"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1600 420"
      >
        <path
          d="M0 150C210 220 415 212 615 150C815 88 1005 72 1205 128C1380 177 1495 190 1600 160V420H0Z"
          fill="var(--shop-catalog-wave-blue)"
        />
        <path
          d="M0 258C220 192 420 218 610 300C805 384 1005 376 1190 300C1375 224 1495 214 1600 248V420H0Z"
          fill="var(--shop-catalog-wave-violet)"
          opacity="0.72"
        />
        <path
          d="M-30 92C210 210 430 225 650 154C900 74 1090 82 1300 154C1440 202 1540 205 1630 178"
          fill="none"
          stroke="var(--shop-catalog-wave-line)"
          strokeLinecap="round"
          strokeWidth="2"
          opacity="0.6"
        />
      </svg>

      <svg
        className="customer-shop-catalog-wave customer-shop-catalog-wave--upper"
        focusable="false"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1600 420"
      >
        <path
          d="M0 88C190 150 370 176 560 142C760 105 930 50 1125 86C1310 120 1465 170 1600 134V420H0Z"
          fill="var(--shop-catalog-wave-blue)"
          opacity="0.8"
        />
        <path
          d="M0 285C205 214 400 228 590 310C785 396 970 390 1150 324C1340 255 1485 244 1600 278V420H0Z"
          fill="var(--shop-catalog-wave-violet)"
          opacity="0.58"
        />
      </svg>

      <svg
        className="customer-shop-catalog-wave customer-shop-catalog-wave--middle"
        focusable="false"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1600 420"
      >
        <path
          d="M0 250C200 160 395 166 585 246C780 328 975 338 1168 268C1360 200 1490 192 1600 226V420H0Z"
          fill="var(--shop-catalog-wave-blue)"
          opacity="0.68"
        />
        <path
          d="M0 112C215 184 415 194 610 136C805 78 995 72 1195 128C1385 182 1500 188 1600 156V420H0Z"
          fill="var(--shop-catalog-wave-violet)"
          opacity="0.5"
        />
        <path
          d="M-25 205C205 122 420 130 640 210C870 294 1080 286 1290 214C1430 166 1535 160 1625 186"
          fill="none"
          stroke="var(--shop-catalog-wave-line)"
          strokeLinecap="round"
          strokeWidth="1.8"
          opacity="0.46"
        />
      </svg>

      <svg
        className="customer-shop-catalog-wave customer-shop-catalog-wave--lower"
        focusable="false"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1600 420"
      >
        <path
          d="M0 100C200 164 390 184 580 144C775 104 945 58 1135 88C1320 118 1468 164 1600 132V420H0Z"
          fill="var(--shop-catalog-wave-blue)"
          opacity="0.72"
        />
        <path
          d="M0 286C220 220 420 236 610 320C805 406 995 394 1180 320C1360 248 1490 238 1600 272V420H0Z"
          fill="var(--shop-catalog-wave-violet)"
          opacity="0.62"
        />
      </svg>

      <svg
        className="customer-shop-catalog-wave customer-shop-catalog-wave--bottom"
        focusable="false"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1600 420"
      >
        <path
          d="M0 166C205 228 400 224 590 172C790 116 965 90 1165 132C1355 172 1490 184 1600 156V420H0Z"
          fill="var(--shop-catalog-wave-blue)"
          opacity="0.82"
        />
        <path
          d="M0 300C215 236 410 246 600 324C800 406 995 402 1185 330C1370 260 1495 252 1600 284V420H0Z"
          fill="var(--shop-catalog-wave-violet)"
          opacity="0.7"
        />
        <path
          d="M-20 260C205 188 410 194 620 270C835 348 1030 344 1230 282C1410 226 1518 220 1620 246"
          fill="none"
          stroke="var(--shop-catalog-wave-line)"
          strokeLinecap="round"
          strokeWidth="1.8"
          opacity="0.42"
        />
      </svg>
    </div>
  );
}
