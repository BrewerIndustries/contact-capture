import logo from '../assets/ankobia-logo.png';
import logoDark from '../assets/ankobia-logo-dark.png';

export function AnkobiaLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-block ${className}`}>
      <img src={logo} alt="Ankobia Group" className="logo-light h-full w-auto" />
      <img src={logoDark} alt="Ankobia Group" className="logo-dark h-full w-auto" />
    </span>
  );
}

// Brand lock-up: logo plus the product name.
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <span className={`flex items-center ${lg ? 'flex-col gap-3' : 'gap-3'}`}>
      <AnkobiaLogo className={lg ? 'h-16' : 'h-8 sm:h-9'} />
      {!lg && <span className="h-6 w-px bg-ink/15" aria-hidden />}
      <span className={`font-semibold tracking-tight ${lg ? 'text-lg text-ink/80' : 'text-sm text-ink/80 sm:text-base'}`}>
        Contact Capture
      </span>
    </span>
  );
}

// Full-page backdrop: two filled swoops (navy→green, green→mint) and a set of flowing
// strokes that echo the logo's arc of dots. Purely decorative; sits behind everything.
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <svg className="h-full w-full" viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sw-navy" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#194073" />
            <stop offset="1" stopColor="#2DB091" />
          </linearGradient>
          <linearGradient id="sw-mint" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2DB091" />
            <stop offset="1" stopColor="#83DBC2" />
          </linearGradient>
          <linearGradient id="st-a" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2DB091" stopOpacity="0" />
            <stop offset="0.35" stopColor="#2DB091" />
            <stop offset="1" stopColor="#83DBC2" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="st-b" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#194073" stopOpacity="0.1" />
            <stop offset="0.6" stopColor="#50C9AA" />
            <stop offset="1" stopColor="#50C9AA" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* filled swoops */}
        <g className="drift-a">
          <path className="swoop-fill" fill="url(#sw-navy)"
            d="M-60,780 C260,650 520,930 880,820 C1140,740 1290,610 1500,660 L1500,1060 L-60,1060 Z" />
        </g>
        <g className="drift-b">
          <path className="swoop-fill" fill="url(#sw-mint)"
            d="M1500,-40 L1500,300 C1290,380 1110,190 930,130 C800,86 720,30 700,-40 Z" />
        </g>

        {/* strokes */}
        <g className="swoop-stroke" fill="none" strokeLinecap="round">
          <path className="drift-a" stroke="url(#st-a)" strokeWidth="3"
            d="M-40,690 C300,560 560,840 900,740 C1150,668 1300,560 1480,590" />
          <path className="drift-b flow-slow" stroke="url(#st-b)" strokeWidth="2"
            d="M-40,740 C260,640 600,900 940,800 C1170,732 1320,640 1480,668" />
          <path className="flow" stroke="#2DB091" strokeWidth="2.5"
            d="M-40,860 C340,760 640,980 1000,880 C1200,824 1340,760 1480,780" />
          <path className="drift-b" stroke="url(#st-a)" strokeWidth="2"
            d="M640,-20 C760,90 900,170 1080,200 C1240,226 1360,170 1480,120" />
          <path className="flow-slow" stroke="url(#st-b)" strokeWidth="1.5"
            d="M560,-20 C700,120 880,230 1090,250 C1260,266 1380,210 1480,170" />
        </g>

        {/* arc of dots, after the logo */}
        <g className="drift-a">
          <circle cx="1200" cy="380" r="9" fill="#AED7CA" opacity="0.55" />
          <circle cx="1236" cy="348" r="9" fill="#83DBC2" opacity="0.6" />
          <circle cx="1276" cy="352" r="9" fill="#50C9AA" opacity="0.6" />
          <circle cx="1304" cy="384" r="9" fill="#2DB091" opacity="0.6" />
        </g>
      </svg>
    </div>
  );
}

// Thin brand stroke under the header.
export function HeaderSwoop() {
  return (
    <svg aria-hidden className="block h-3 w-full" viewBox="0 0 1440 24" preserveAspectRatio="none">
      <defs>
        <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#194073" />
          <stop offset="0.55" stopColor="#2DB091" />
          <stop offset="1" stopColor="#83DBC2" />
        </linearGradient>
      </defs>
      <path d="M0,4 C360,22 720,-6 1080,12 C1260,21 1360,14 1440,8" fill="none" stroke="url(#hdr)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
