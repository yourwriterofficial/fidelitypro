import React from 'react';

export interface SealDefinition {
  id: string;
  name: string;
  theme: 'universal' | 'rpm' | 'both';
  category: 'Notarial' | 'Fiduciary' | 'International' | 'Treasury' | 'Compliance' | 'Executive';
  description: string;
  primaryColor: string;
  badgeText: string;
}

export const SEAL_DEFINITIONS: SealDefinition[] = [
  // ── UNIVERSAL / INDEPENDENT SEALS ─────────────────────────────────────────
  {
    id: 'universal-notary-crimson',
    name: 'Notary Public Jurat Seal (Crimson Ink)',
    theme: 'universal',
    category: 'Notarial',
    description: 'Authentic crimson red rubber ink stamp with starburst perimeter, Scales of Justice, and statutory sworn attestation.',
    primaryColor: '#b91c1c',
    badgeText: 'Sworn Notary',
  },
  {
    id: 'universal-fiduciary-navy',
    name: 'Independent Fiduciary Counsel Seal (Deep Navy)',
    theme: 'universal',
    category: 'Fiduciary',
    description: 'Deep royal navy blue circular stamp with rope border, escrow key insignia, and bar attestation credentials.',
    primaryColor: '#1e3a8a',
    badgeText: 'Fiduciary Escrow',
  },
  {
    id: 'universal-gold-embossed',
    name: 'Gilded Medallion & Ribbon Seal (Antique Gold)',
    theme: 'universal',
    category: 'Executive',
    description: 'Embossed 32-point gold foil medallion seal with dual ceremonial ribbon tails for high-value conveyances.',
    primaryColor: '#b45309',
    badgeText: 'Gilded Foil',
  },
  {
    id: 'universal-apostille',
    name: 'Hague Apostille International Stamp (Indigo Violet)',
    theme: 'universal',
    category: 'International',
    description: 'Hague Convention 1961 legal certification stamp for cross-border recognition and statutory validity.',
    primaryColor: '#312e81',
    badgeText: 'Hague Apostille',
  },

  // ── RPM PLATFORM CORPORATE SEALS ──────────────────────────────────────────
  {
    id: 'rpm-treasury-emerald',
    name: 'RPM Corporate Treasury Seal (Emerald Green)',
    theme: 'rpm',
    category: 'Treasury',
    description: 'Official RPM Platform Treasury seal with precision gear rim, RPM chevron crest, and verified ledger clearance.',
    primaryColor: '#047857',
    badgeText: 'RPM Treasury',
  },
  {
    id: 'rpm-compliance-blue',
    name: 'RPM Compliance & Audit Seal (Cobalt Blue)',
    theme: 'rpm',
    category: 'Compliance',
    description: 'RPM Legal & Regulatory Directorate seal with 12 compliance stars, audit shield, and internal archive docket.',
    primaryColor: '#1d4ed8',
    badgeText: 'Audit Certified',
  },
  {
    id: 'rpm-gold-executive',
    name: 'RPM Executive Capital Settlement Seal (Gold)',
    theme: 'rpm',
    category: 'Executive',
    description: 'Executive desk gold medallion for verified high-tier capital withdrawals and permanent investor settlements.',
    primaryColor: '#b45309',
    badgeText: 'Executive Desk',
  },
  {
    id: 'rpm-notary-crimson',
    name: 'Joint Notary Attestation on RPM Instrument (Crimson)',
    theme: 'both',
    category: 'Notarial',
    description: 'Co-affixed independent notarial seal certifying RPM platform records for external banking and judicial filing.',
    primaryColor: '#b91c1c',
    badgeText: 'Joint Attestation',
  },
];

interface SealProps {
  sealId: string;
  docketNo?: string;
  date?: string;
  tilt?: 'tilted' | 'upright' | 'angled-right' | number;
  color?: string;
  size?: number;
  className?: string;
}

/**
 * Builds a standalone SVG string for the chosen seal.
 * Can be rendered directly in React or embedded in standalone HTML emails/PDFs.
 */
export function renderSealSvgString(options: {
  sealId: string;
  docketNo?: string;
  date?: string;
  color?: string;
  tiltAngle?: number;
  size?: number;
}): string {
  const {
    sealId = 'universal-notary-crimson',
    docketNo = 'DISB-2026-89421',
    date = '2026',
    color,
    tiltAngle = -5,
    size = 148,
  } = options;

  const def = SEAL_DEFINITIONS.find((s) => s.id === sealId) || SEAL_DEFINITIONS[0];
  const stroke = color || def.primaryColor;
  const safeDocket = docketNo.slice(0, 18);
  const uid = Math.random().toString(36).substring(2, 8);

  // 1. UNIVERSAL NOTARY CRIMSON
  if (sealId === 'universal-notary-crimson' || sealId === 'rpm-notary-crimson') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" style="transform: rotate(${tiltAngle}deg); display: inline-block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.08));">
        <defs>
          <path id="circlePathTop_${uid}" d="M 30,100 A 70,70 0 1,1 170,100" fill="none" />
          <path id="circlePathBottom_${uid}" d="M 170,100 A 70,70 0 0,1 30,100" fill="none" />
        </defs>
        <!-- Outer serrated points / dentils -->
        <circle cx="100" cy="100" r="94" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-dasharray="3.5 2.5" opacity="0.85" />
        <circle cx="100" cy="100" r="88" fill="none" stroke="${stroke}" stroke-width="2.5" />
        <circle cx="100" cy="100" r="84" fill="none" stroke="${stroke}" stroke-width="0.8" />
        <!-- Top Arc Text -->
        <text fill="${stroke}" font-size="8" font-family="Georgia, serif" font-weight="bold" letter-spacing="1.8">
          <textPath href="#circlePathTop_${uid}" startOffset="50%" text-anchor="middle">
            ★ NOTARY PUBLIC · STATE ATTESTATION ★
          </textPath>
        </text>
        <!-- Bottom Arc Text -->
        <text fill="${stroke}" font-size="7.5" font-family="monospace" font-weight="bold" letter-spacing="1.5">
          <textPath href="#circlePathBottom_${uid}" startOffset="50%" text-anchor="middle">
            ★ OFFICIAL JURAT · COMM #4829104 ★
          </textPath>
        </text>
        <!-- Inner Ring -->
        <circle cx="100" cy="100" r="56" fill="none" stroke="${stroke}" stroke-width="1.5" />
        <circle cx="100" cy="100" r="53" fill="none" stroke="${stroke}" stroke-width="0.7" stroke-dasharray="2 2" />
        <!-- Center Emblem: Scales of Justice -->
        <g stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" transform="translate(76, 68) scale(0.9)">
          <path d="M26 6 L26 34" stroke-width="2" />
          <path d="M12 12 L40 12" stroke-width="2" />
          <path d="M18 34 L34 34" stroke-width="2.5" />
          <path d="M12 12 L6 22 L18 22 Z" fill="${stroke}" fill-opacity="0.12" />
          <path d="M40 12 L34 22 L46 22 Z" fill="${stroke}" fill-opacity="0.12" />
          <circle cx="26" cy="6" r="2.5" fill="${stroke}" />
        </g>
        <!-- Center Text -->
        <text x="100" y="112" text-anchor="middle" fill="${stroke}" font-family="Georgia, serif" font-size="6.5" font-weight="bold" letter-spacing="0.8">SWORN &amp; RECORDED</text>
        <text x="100" y="122" text-anchor="middle" fill="${stroke}" font-family="monospace" font-size="6" font-weight="bold">${safeDocket}</text>
        <text x="100" y="130" text-anchor="middle" fill="${stroke}" font-family="Georgia, serif" font-size="5.5" font-style="italic">COMM. EXPIRES 2029</text>
      </svg>
    `;
  }

  // 2. UNIVERSAL FIDUCIARY NAVY
  if (sealId === 'universal-fiduciary-navy') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" style="transform: rotate(${tiltAngle}deg); display: inline-block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.08));">
        <defs>
          <path id="circlePathTop_fid_${uid}" d="M 28,100 A 72,72 0 1,1 172,100" fill="none" />
          <path id="circlePathBottom_fid_${uid}" d="M 172,100 A 72,72 0 0,1 28,100" fill="none" />
        </defs>
        <!-- Outer rope/dash effect -->
        <circle cx="100" cy="100" r="94" fill="none" stroke="${stroke}" stroke-width="3" stroke-dasharray="4 3" />
        <circle cx="100" cy="100" r="86" fill="none" stroke="${stroke}" stroke-width="1.8" />
        <!-- Top Arc Text -->
        <text fill="${stroke}" font-size="7.5" font-family="-apple-system, sans-serif" font-weight="800" letter-spacing="1.4">
          <textPath href="#circlePathTop_fid_${uid}" startOffset="50%" text-anchor="middle">
            INDEPENDENT DISBURSEMENT COUNSEL
          </textPath>
        </text>
        <!-- Bottom Arc Text -->
        <text fill="${stroke}" font-size="7.2" font-family="-apple-system, sans-serif" font-weight="700" letter-spacing="1.2">
          <textPath href="#circlePathBottom_fid_${uid}" startOffset="50%" text-anchor="middle">
            ★ OFFICIAL FIDUCIARY ATTESTATION ★
          </textPath>
        </text>
        <!-- Inner Ring -->
        <circle cx="100" cy="100" r="58" fill="none" stroke="${stroke}" stroke-width="1.6" />
        <!-- Center Emblem: Escrow Shield & Key -->
        <g stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" transform="translate(80, 68) scale(0.85)">
          <path d="M24 4 L42 10 C42 28 24 38 24 42 C24 38 6 28 6 10 Z" fill="${stroke}" fill-opacity="0.1" stroke-width="2" />
          <path d="M24 16 L24 28" stroke-width="2" />
          <circle cx="24" cy="16" r="3.5" fill="${stroke}" />
          <path d="M24 23 L28 23" stroke-width="2" />
          <path d="M24 27 L27 27" stroke-width="2" />
        </g>
        <!-- Center Text -->
        <text x="100" y="114" text-anchor="middle" fill="${stroke}" font-family="monospace" font-size="7" font-weight="bold" letter-spacing="1">ESCROW CLEARED</text>
        <text x="100" y="123" text-anchor="middle" fill="${stroke}" font-family="-apple-system, sans-serif" font-size="6" font-weight="700">MCMAHON &amp; ASSOCIATES</text>
        <text x="100" y="131" text-anchor="middle" fill="${stroke}" font-family="monospace" font-size="5.5">${safeDocket}</text>
      </svg>
    `;
  }

  // 3. UNIVERSAL GOLD EMBOSSED MEDALLION (WITH CEREMONIAL RIBBONS)
  if (sealId === 'universal-gold-embossed') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 230" width="${size}" height="${(size * 230) / 200}" style="transform: rotate(${tiltAngle}deg); display: inline-block; filter: drop-shadow(0 3px 6px rgba(180,83,9,0.25));">
        <defs>
          <path id="circlePathTop_gold_${uid}" d="M 32,95 A 68,68 0 1,1 168,95" fill="none" />
          <path id="circlePathBottom_gold_${uid}" d="M 168,95 A 68,68 0 0,1 32,95" fill="none" />
          <linearGradient id="goldGrad_${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#d97706" />
            <stop offset="50%" stop-color="#f59e0b" />
            <stop offset="100%" stop-color="#b45309" />
          </linearGradient>
        </defs>
        <!-- Ceremonial Hanging Ribbons -->
        <path d="M 76,145 L 68,220 L 82,210 L 96,220 L 90,145 Z" fill="#991b1b" opacity="0.9" />
        <path d="M 110,145 L 104,220 L 118,210 L 132,220 L 124,145 Z" fill="#991b1b" opacity="0.9" />
        <!-- 32-point Medallion Starburst Teeth -->
        <circle cx="100" cy="95" r="90" fill="url(#goldGrad_${uid})" stroke="${stroke}" stroke-width="2" />
        <circle cx="100" cy="95" r="82" fill="#fffdfa" stroke="${stroke}" stroke-width="1.8" />
        <circle cx="100" cy="95" r="78" fill="none" stroke="${stroke}" stroke-width="0.8" stroke-dasharray="3 2" />
        <!-- Top Arc Text -->
        <text fill="${stroke}" font-size="7" font-family="Georgia, serif" font-weight="bold" letter-spacing="1.5">
          <textPath href="#circlePathTop_gold_${uid}" startOffset="50%" text-anchor="middle">
            ★ OFFICIAL LEGAL ATTESTATION ★
          </textPath>
        </text>
        <!-- Bottom Arc Text -->
        <text fill="${stroke}" font-size="6.8" font-family="Georgia, serif" font-weight="bold" letter-spacing="1.2">
          <textPath href="#circlePathBottom_gold_${uid}" startOffset="50%" text-anchor="middle">
            ★ FIDUCIARY RECORD &amp; CONVEYANCE ★
          </textPath>
        </text>
        <!-- Inner Crest -->
        <circle cx="100" cy="95" r="52" fill="#fffbeb" stroke="${stroke}" stroke-width="1.5" />
        <path d="M100 68 L104 78 L114 80 L106 88 L108 98 L100 92 L92 98 L94 88 L86 80 L96 78 Z" fill="${stroke}" />
        <text x="100" y="110" text-anchor="middle" fill="${stroke}" font-family="Georgia, serif" font-size="7.5" font-weight="bold" letter-spacing="1">SEALED UNDER ACT</text>
        <text x="100" y="119" text-anchor="middle" fill="${stroke}" font-family="monospace" font-size="6" font-weight="bold">${safeDocket}</text>
        <text x="100" y="128" text-anchor="middle" fill="${stroke}" font-family="Georgia, serif" font-size="5.5" font-style="italic">INDEPENDENT BAR</text>
      </svg>
    `;
  }

  // 4. UNIVERSAL HAGUE APOSTILLE STAMP
  if (sealId === 'universal-apostille') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" style="transform: rotate(${tiltAngle}deg); display: inline-block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.08));">
        <rect x="10" y="10" width="180" height="180" rx="6" fill="none" stroke="${stroke}" stroke-width="2.5" />
        <rect x="15" y="15" width="170" height="170" rx="4" fill="none" stroke="${stroke}" stroke-width="0.8" />
        <!-- Header -->
        <text x="100" y="32" text-anchor="middle" fill="${stroke}" font-family="Georgia, serif" font-size="10.5" font-weight="bold" letter-spacing="2">APOSTILLE</text>
        <text x="100" y="42" text-anchor="middle" fill="${stroke}" font-family="Georgia, serif" font-size="6" font-style="italic">(Convention de La Haye du 5 Octobre 1961)</text>
        <line x1="20" y1="46" x2="180" y2="46" stroke="${stroke}" stroke-width="1" />
        <!-- Hague Fields -->
        <g fill="${stroke}" font-family="Georgia, serif" font-size="6.2">
          <text x="24" y="60">1. Country: <tspan font-weight="bold">United States of America</tspan></text>
          <text x="24" y="73">2. Signed by: <tspan font-weight="bold">Dean McMahon, Esq.</tspan></text>
          <text x="24" y="86">3. Capacity: <tspan font-weight="bold">Independent Fiduciary Counsel</tspan></text>
          <text x="24" y="99">4. Registry: <tspan font-weight="bold">McMahon &amp; Associates Bar</tspan></text>
          <text x="24" y="112">5. Certified at: <tspan font-weight="bold">New York, NY · ${date}</tspan></text>
          <text x="24" y="125">6. Act No: <tspan font-family="monospace" font-weight="bold">${safeDocket}</tspan></text>
        </g>
        <line x1="20" y1="133" x2="180" y2="133" stroke="${stroke}" stroke-width="0.8" stroke-dasharray="2 2" />
        <!-- Jurat Seal Footer -->
        <circle cx="100" cy="154" r="16" fill="none" stroke="${stroke}" stroke-width="1.2" />
        <text x="100" y="152" text-anchor="middle" fill="${stroke}" font-family="Georgia, serif" font-size="5" font-weight="bold">OFFICIAL</text>
        <text x="100" y="158" text-anchor="middle" fill="${stroke}" font-family="Georgia, serif" font-size="5" font-weight="bold">SEAL</text>
        <text x="100" y="180" text-anchor="middle" fill="${stroke}" font-family="monospace" font-size="5.5" font-weight="bold">HAGUE TREATY CONFORMING</text>
      </svg>
    `;
  }

  // 5. RPM TREASURY EMERALD SEAL
  if (sealId === 'rpm-treasury-emerald') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" style="transform: rotate(${tiltAngle}deg); display: inline-block; filter: drop-shadow(0 2px 4px rgba(4,120,87,0.15));">
        <defs>
          <path id="circlePathTop_rpm_${uid}" d="M 28,100 A 72,72 0 1,1 172,100" fill="none" />
          <path id="circlePathBottom_rpm_${uid}" d="M 172,100 A 72,72 0 0,1 28,100" fill="none" />
        </defs>
        <!-- Precision Milled Cog / Gear Rim -->
        <circle cx="100" cy="100" r="94" fill="none" stroke="${stroke}" stroke-width="3" stroke-dasharray="2.5 3" />
        <circle cx="100" cy="100" r="86" fill="none" stroke="${stroke}" stroke-width="2" />
        <circle cx="100" cy="100" r="82" fill="none" stroke="${stroke}" stroke-width="0.8" />
        <!-- Top Arc Text -->
        <text fill="${stroke}" font-size="7.5" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="800" letter-spacing="1.4">
          <textPath href="#circlePathTop_rpm_${uid}" startOffset="50%" text-anchor="middle">
            ★ REMA PROFIT MACHINE · TREASURY ★
          </textPath>
        </text>
        <!-- Bottom Arc Text -->
        <text fill="${stroke}" font-size="7" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="700" letter-spacing="1.1">
          <textPath href="#circlePathBottom_rpm_${uid}" startOffset="50%" text-anchor="middle">
            ★ CAPITAL SETTLEMENT &amp; CLEARANCE ★
          </textPath>
        </text>
        <!-- Inner Ring -->
        <circle cx="100" cy="100" r="56" fill="none" stroke="${stroke}" stroke-width="1.8" />
        <circle cx="100" cy="100" r="52" fill="none" stroke="${stroke}" stroke-width="0.6" stroke-dasharray="2 2" />
        <!-- RPM Center Crest: Monogram 'R' & Upward Growth Chevron -->
        <g stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" transform="translate(82, 65) scale(0.9)">
          <path d="M12 4 L12 36" stroke-width="2.5" />
          <path d="M12 4 L26 4 C32 4 32 18 26 18 L12 18" stroke-width="2.5" fill="${stroke}" fill-opacity="0.12" />
          <path d="M22 18 L32 36" stroke-width="2.5" />
          <path d="M30 8 L36 4 L36 10" stroke-width="1.5" />
        </g>
        <!-- Center Text -->
        <text x="100" y="112" text-anchor="middle" fill="${stroke}" font-family="-apple-system, sans-serif" font-size="7.5" font-weight="900" letter-spacing="0.8">TREASURY CLEARED</text>
        <text x="100" y="122" text-anchor="middle" fill="${stroke}" font-family="monospace" font-size="6.5" font-weight="bold">${safeDocket}</text>
        <text x="100" y="130" text-anchor="middle" fill="${stroke}" font-family="-apple-system, sans-serif" font-size="5" font-weight="bold" letter-spacing="0.5">PERMANENT LEDGER ARCHIVE</text>
      </svg>
    `;
  }

  // 6. RPM COMPLIANCE BLUE
  if (sealId === 'rpm-compliance-blue') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" style="transform: rotate(${tiltAngle}deg); display: inline-block; filter: drop-shadow(0 2px 4px rgba(29,78,216,0.15));">
        <defs>
          <path id="circlePathTop_comp_${uid}" d="M 28,100 A 72,72 0 1,1 172,100" fill="none" />
          <path id="circlePathBottom_comp_${uid}" d="M 172,100 A 72,72 0 0,1 28,100" fill="none" />
        </defs>
        <!-- 12 Compliance Stars Ring -->
        <circle cx="100" cy="100" r="94" fill="none" stroke="${stroke}" stroke-width="2.5" />
        <circle cx="100" cy="100" r="86" fill="none" stroke="${stroke}" stroke-width="1.2" stroke-dasharray="4 2" />
        <!-- Top Arc Text -->
        <text fill="${stroke}" font-size="7.5" font-family="-apple-system, sans-serif" font-weight="800" letter-spacing="1.2">
          <textPath href="#circlePathTop_comp_${uid}" startOffset="50%" text-anchor="middle">
            ★ RPM COMPLIANCE DIRECTORATE ★
          </textPath>
        </text>
        <!-- Bottom Arc Text -->
        <text fill="${stroke}" font-size="7" font-family="-apple-system, sans-serif" font-weight="700" letter-spacing="1">
          <textPath href="#circlePathBottom_comp_${uid}" startOffset="50%" text-anchor="middle">
            ★ AUDIT VERIFIED &amp; CERTIFIED ★
          </textPath>
        </text>
        <!-- Inner Ring -->
        <circle cx="100" cy="100" r="56" fill="none" stroke="${stroke}" stroke-width="1.6" />
        <!-- Center Emblem: Shield with Check -->
        <g stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" transform="translate(80, 68) scale(0.85)">
          <path d="M24 4 L42 10 C42 28 24 38 24 42 C24 38 6 28 6 10 Z" fill="${stroke}" fill-opacity="0.1" />
          <path d="M15 22 L21 28 L33 16" stroke-width="2.5" />
        </g>
        <text x="100" y="114" text-anchor="middle" fill="${stroke}" font-family="-apple-system, sans-serif" font-size="7" font-weight="800" letter-spacing="0.8">AUDIT CLEARANCE PASS</text>
        <text x="100" y="123" text-anchor="middle" fill="${stroke}" font-family="monospace" font-size="6" font-weight="bold">${safeDocket}</text>
        <text x="100" y="131" text-anchor="middle" fill="${stroke}" font-family="-apple-system, sans-serif" font-size="5" font-weight="bold">INTERNAL LEGAL ARCHIVE</text>
      </svg>
    `;
  }

  // 7. RPM GOLD EXECUTIVE MEDALLION
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" style="transform: rotate(${tiltAngle}deg); display: inline-block; filter: drop-shadow(0 2px 6px rgba(180,83,9,0.2));">
      <defs>
        <path id="circlePathTop_exec_${uid}" d="M 30,100 A 70,70 0 1,1 170,100" fill="none" />
        <path id="circlePathBottom_exec_${uid}" d="M 170,100 A 70,70 0 0,1 30,100" fill="none" />
      </defs>
      <circle cx="100" cy="100" r="92" fill="none" stroke="${stroke}" stroke-width="3" stroke-dasharray="3 3" />
      <circle cx="100" cy="100" r="84" fill="none" stroke="${stroke}" stroke-width="1.8" />
      <text fill="${stroke}" font-size="7.5" font-family="Georgia, serif" font-weight="bold" letter-spacing="1.4">
        <textPath href="#circlePathTop_exec_${uid}" startOffset="50%" text-anchor="middle">
          ★ REMA PROFIT MACHINE · EXECUTIVE ★
        </textPath>
      </text>
      <text fill="${stroke}" font-size="7" font-family="Georgia, serif" font-weight="bold" letter-spacing="1.2">
        <textPath href="#circlePathBottom_exec_${uid}" startOffset="50%" text-anchor="middle">
          ★ IRREVOCABLE CAPITAL RELEASE ★
        </textPath>
      </text>
      <circle cx="100" cy="100" r="54" fill="#fffbeb" stroke="${stroke}" stroke-width="1.8" />
      <!-- Center Diamond Crest -->
      <polygon points="100,68 116,84 100,100 84,84" fill="${stroke}" fill-opacity="0.15" stroke="${stroke}" stroke-width="1.8" />
      <text x="100" y="88" text-anchor="middle" fill="${stroke}" font-family="Georgia, serif" font-size="12" font-weight="bold">R</text>
      <text x="100" y="112" text-anchor="middle" fill="${stroke}" font-family="Georgia, serif" font-size="7" font-weight="bold">EXECUTIVE APPROVED</text>
      <text x="100" y="122" text-anchor="middle" fill="${stroke}" font-family="monospace" font-size="6" font-weight="bold">${safeDocket}</text>
    </svg>
  `;
}

export const LegalStampSeal: React.FC<SealProps> = ({
  sealId,
  docketNo = 'DISB-2026-89421',
  date = '2026',
  tilt = 'tilted',
  color,
  size = 148,
  className = '',
}) => {
  let tiltAngle = -5;
  if (typeof tilt === 'number') {
    tiltAngle = tilt;
  } else if (tilt === 'upright') {
    tiltAngle = 0;
  } else if (tilt === 'angled-right') {
    tiltAngle = 5;
  }

  const svgHtml = renderSealSvgString({
    sealId,
    docketNo,
    date,
    color,
    tiltAngle,
    size,
  });

  return (
    <div
      className={`inline-block select-none transition-transform hover:scale-105 duration-200 ${className}`}
      style={{ width: size, minWidth: size }}
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
};
