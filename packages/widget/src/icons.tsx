import type { SVGProps } from 'react'

/**
 * USDC mark by Circle, full color. Source: spothq/cryptocurrency-icons,
 * the de-facto USDC mark across DeFi UIs.
 */
export function UsdcIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" role="img" aria-label="USDC" {...props}>
      <g fill="none">
        <circle fill="#3E73C4" cx="16" cy="16" r="16" />
        <g fill="#FFF">
          <path d="M20.022 18.124c0-2.124-1.28-2.852-3.84-3.156-1.828-.243-2.193-.728-2.193-1.578 0-.85.61-1.396 1.828-1.396 1.097 0 1.707.364 2.011 1.275a.458.458 0 00.427.303h.975a.416.416 0 00.427-.425v-.06a3.04 3.04 0 00-2.743-2.489V9.142c0-.243-.183-.425-.487-.486h-.915c-.243 0-.426.182-.487.486v1.396c-1.829.242-2.986 1.456-2.986 2.974 0 2.002 1.218 2.791 3.778 3.095 1.707.303 2.255.668 2.255 1.639 0 .97-.853 1.638-2.011 1.638-1.585 0-2.133-.667-2.316-1.578-.06-.242-.244-.364-.427-.364h-1.036a.416.416 0 00-.426.425v.06c.243 1.518 1.219 2.61 3.23 2.914v1.457c0 .242.183.425.487.485h.915c.243 0 .426-.182.487-.485V21.34c1.829-.303 3.047-1.578 3.047-3.217z" />
          <path d="M12.892 24.497c-4.754-1.7-7.192-6.98-5.424-11.653.914-2.55 2.925-4.491 5.424-5.402.244-.121.365-.303.365-.607v-.85c0-.242-.121-.424-.365-.485-.061 0-.183 0-.244.06a10.895 10.895 0 00-7.13 13.717c1.096 3.4 3.717 6.01 7.13 7.102.244.121.488 0 .548-.243.061-.06.061-.122.061-.243v-.85c0-.182-.182-.424-.365-.546zm6.46-18.936c-.244-.122-.488 0-.548.242-.061.061-.061.122-.061.243v.85c0 .243.182.485.365.607 4.754 1.7 7.192 6.98 5.424 11.653-.914 2.55-2.925 4.491-5.424 5.402-.244.121-.365.303-.365.607v.85c0 .242.121.424.365.485.061 0 .183 0 .244-.06a10.895 10.895 0 007.13-13.717c-1.096-3.46-3.778-6.07-7.13-7.162z" />
        </g>
      </g>
    </svg>
  )
}

/**
 * USDH mark by Native Markets, full color. Source: https://usdh.com/usdh_logo.svg
 * (canonical asset, Content-Type image/svg+xml).
 */
export function UsdhIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 460 460"
      width="22"
      height="22"
      fill="none"
      role="img"
      aria-label="USDH"
      {...props}
    >
      <rect width="460" height="460" rx="230" fill="url(#usdh-bg)" />
      <path d="M246 126L214 126L214 61L246 61L246 126Z" fill="url(#usdh-top)" />
      <path d="M246 336L214 336L214 401L246 401L246 336Z" fill="url(#usdh-bottom)" />
      <path d="M165 320.5L165 289.5L127 289.5L127 320.5L165 320.5Z" fill="url(#usdh-left)" />
      <path d="M290.5 142V173H165V216H325V320.5H165V289.5H294V247H134V142H290.5Z" fill="#4AFFC6" />
      <path d="M290 173L290 142L335 142L335 173L290 173Z" fill="url(#usdh-right)" />
      <defs>
        <linearGradient
          id="usdh-bg"
          x1="230"
          y1="0"
          x2="230"
          y2="460"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#063124" />
          <stop offset="1" stopColor="#002B1E" />
        </linearGradient>
        <linearGradient
          id="usdh-top"
          x1="230"
          y1="126"
          x2="230"
          y2="61"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#4AFFC6" />
          <stop offset="0.971448" stopColor="#4AFFC6" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id="usdh-bottom"
          x1="230"
          y1="336"
          x2="230"
          y2="401"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#4AFFC6" />
          <stop offset="0.971448" stopColor="#4AFFC6" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id="usdh-left"
          x1="165"
          y1="305"
          x2="127"
          y2="305"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.112947" stopColor="#4AFFC6" />
          <stop offset="1" stopColor="#4AFFC6" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id="usdh-right"
          x1="290"
          y1="157.5"
          x2="335"
          y2="157.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.112947" stopColor="#4AFFC6" />
          <stop offset="1" stopColor="#4AFFC6" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/** Sentral monogram, official mark. */
export function SentralMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 145 168"
      width="11"
      height="13"
      fill="none"
      role="img"
      aria-label="Sentral"
      {...props}
    >
      <path
        d="M67.9013 65.2157L128.157 81.3306C137.863 83.9261 144.612 92.7056 144.612 102.737V130.431L83.5978 114.114V128.387C83.5978 138.417 76.8491 147.196 67.1426 149.793L0 167.75V123.05L58.5053 107.402L25.6816 98.6228C10.5333 94.5722 0 80.8699 0 65.2157C0 49.5616 10.5333 35.8593 25.6816 31.8086L144.612 0V27.6949C144.612 37.7246 137.863 46.5041 128.157 49.1008L67.9013 65.2157Z"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * LiquidTerminal monogram, official mark. Original brand colors preserved.
 * viewBox tightened around the visible content (mountain + droplet + dash) so
 * the rendered icon optical weight matches the Sentral mark next to it.
 */
export function LiquidTerminalMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="130 110 540 580"
      width="13"
      height="13"
      role="img"
      aria-label="LiquidTerminal"
      {...props}
    >
      <polygon
        points="462.14 405.28 437.5 405.28 386.14 311.63 310.14 173.05 234.15 311.63 182.79 405.28 158.15 405.28 234.15 266.7 310.14 128.13 386.14 266.7 462.14 405.28"
        fill="#fff"
        stroke="#fff"
        strokeWidth="28.92"
        strokeMiterlimit="10"
      />
      <path
        d="m478.82,491.36c0,89.4-75.3,161.86-168.17,161.86s-168.18-72.46-168.18-161.86h26.62c0,74.76,62.98,135.35,140.65,135.35s140.63-60.59,140.63-135.35h28.44Z"
        fill="#93d4ed"
        stroke="#93d4ed"
        strokeWidth="30.43"
        strokeMiterlimit="10"
      />
      <rect x="540.53" y="626.67" width="117" height="45.21" fill="#fff" />
    </svg>
  )
}

export function SwitchHorizontal(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M16 4l4 4-4 4M20 8H4M8 20l-4-4 4-4M4 16h16" />
    </svg>
  )
}

export function ArrowDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  )
}

export function Spinner(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function MaxBadge(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}
