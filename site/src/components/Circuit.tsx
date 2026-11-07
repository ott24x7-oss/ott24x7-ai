/**
 * Decorative circuit-board traces for the hero (red on the left, cyan on the
 * right) with small data pulses running along them. Pure SVG, no images.
 */
const LEFT = [
  'M0 120 H140 L180 160 H320 L350 190',
  'M0 220 H90 L130 260 H260',
  'M0 330 H180 L220 290 H300 L330 260',
  'M40 0 V70 L80 110 H200',
  'M0 430 H120 L160 470 H240',
];
const RIGHT = [
  'M1200 140 H1060 L1020 180 H880 L850 210',
  'M1200 250 H1110 L1070 290 H940',
  'M1200 360 H1020 L980 320 H900 L870 290',
  'M1160 0 V80 L1120 120 H1000',
  'M1200 460 H1080 L1040 500 H960',
];
const NODES_L = [
  [350, 190],
  [260, 260],
  [330, 260],
  [200, 110],
  [240, 470],
];
const NODES_R = [
  [850, 210],
  [940, 290],
  [870, 290],
  [1000, 120],
  [960, 500],
];

export function Circuit() {
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 top-0 h-[560px] w-full [mask-image:linear-gradient(180deg,#000_55%,transparent)] sm:h-[620px]"
      viewBox="0 0 1200 560"
      preserveAspectRatio="xMidYMin slice"
      aria-hidden="true"
      fill="none"
    >
      <g stroke="var(--trace-base)" strokeWidth="1.5">
        {[...LEFT, ...RIGHT].map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g stroke="var(--trace-red)" strokeWidth="2" strokeLinecap="round">
        {LEFT.map((d, i) => (
          <path key={d} d={d} className="trace-pulse" style={{ animationDelay: `${i * -1.1}s` }} />
        ))}
      </g>
      <g stroke="var(--trace-blue)" strokeWidth="2" strokeLinecap="round">
        {RIGHT.map((d, i) => (
          <path key={d} d={d} className="trace-pulse" style={{ animationDelay: `${i * -1.3 - 0.5}s` }} />
        ))}
      </g>
      {NODES_L.map(([x, y]) => (
        <circle key={`l${x}${y}`} cx={x} cy={y} r="3.5" fill="var(--bg)" stroke="var(--trace-red)" strokeWidth="1.5" />
      ))}
      {NODES_R.map(([x, y]) => (
        <circle key={`r${x}${y}`} cx={x} cy={y} r="3.5" fill="var(--bg)" stroke="var(--trace-blue)" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
