import React from 'react'

/**
 * PropFyndr — High-Fidelity Vector Email Client Logos
 * Official authentic vector brand marks for Google Gmail, Microsoft Outlook, and Apple Mail.
 * Tuned for pixel-crisp display at micro sizes (12px-24px) with high color fidelity.
 */

export function GmailLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 448"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Google Gmail"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      {/* Bottom-left Blue Pillar */}
      <path
        fill="#4285F4"
        d="M34.9 448h81.5V250.2L0 163v250.2C0 432.5 15.7 448 34.9 448z"
      />
      {/* Bottom-right Green Pillar */}
      <path
        fill="#34A853"
        d="M395.6 448h81.5c19.3 0 34.9-15.7 34.9-34.9V163l-116.4 87.2V448z"
      />
      {/* Top-right Dark Red Crease */}
      <path
        fill="#C5221F"
        d="M395.6 99v151.2L512 163V116.4C512 73.4 463.3 49 428.3 73.9L395.6 99z"
      />
      {/* Top-left Yellow Crease */}
      <path
        fill="#FBBC04"
        d="M0 116.4V163l116.4 87.2V99l-32.7-25.1C48.7 49 0 73.4 0 116.4z"
      />
      {/* Center Red V-Fold */}
      <path
        fill="#EA4335"
        d="M116.4 99v151.2l139.6 104.7 139.6-104.7V99L256 0 116.4 99z"
      />
    </svg>
  )
}

export function OutlookLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Microsoft Outlook"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <defs>
        <linearGradient
          id="msftOutlookBadgeGrad"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#0A78D4" />
          <stop offset="100%" stopColor="#004E8C" />
        </linearGradient>
        <filter id="msftOutlookDrop" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0.5" dy="1" stdDeviation="1" floodColor="#001830" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Envelope Back Base */}
      <rect x="13" y="6" width="17" height="20" rx="2.5" fill="#0078D4" />

      {/* Top Envelope Flap Light Cyan-Blue */}
      <path
        d="M30 8.5L20.5 15.5 13 11V6h14.5a2.5 2.5 0 0 1 2.5 2.5z"
        fill="#28A8EA"
      />

      {/* Middle/Bottom Inner Shading Fold */}
      <path
        d="M13 11l7.5 4.5L30 8.5v12L20.5 25 13 19.5V11z"
        fill="#106EBE"
      />

      {/* Bottom Fold Base Dark Blue */}
      <path
        d="M13 19.5l7.5 5.5 9.5-7V23.5a2.5 2.5 0 0 1-2.5 2.5H13v-6.5z"
        fill="#005A9E"
      />

      {/* Left Front 'O' Badge with Shadow and Smooth Rounded Rect */}
      <g filter="url(#msftOutlookDrop)">
        <rect
          x="2"
          y="5"
          width="16.5"
          height="22"
          rx="3.5"
          fill="url(#msftOutlookBadgeGrad)"
        />
        {/* Crisp Center Letter O */}
        <ellipse
          cx="10.25"
          cy="16"
          rx="4.2"
          ry="5.2"
          stroke="#FFFFFF"
          strokeWidth="2.4"
          fill="none"
        />
      </g>
    </svg>
  )
}

export function AppleMailLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Apple Mail"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <defs>
        <linearGradient
          id="appleMailAppGrad"
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#4FB3FF" />
          <stop offset="50%" stopColor="#0A84FF" />
          <stop offset="100%" stopColor="#0066CC" />
        </linearGradient>
        <filter id="appleMailDrop" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="0.8" floodColor="#002D62" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* iOS App Squircle */}
      <rect width="32" height="32" rx="7.5" fill="url(#appleMailAppGrad)" />

      {/* Crisp White Envelope Icon */}
      <g filter="url(#appleMailDrop)">
        {/* Envelope Body */}
        <path
          d="M6 10.5C6 9.12 7.12 8 8.5 8h15c1.38 0 2.5 1.12 2.5 2.5v11c0 1.38-1.12 2.5-2.5 2.5h-15C7.12 24 6 22.88 6 21.5v-11z"
          fill="#FFFFFF"
        />
        {/* Blue Fold Line on White Envelope */}
        <path
          d="M6.8 9.8L16 16.8l9.2-7"
          stroke="#0A84FF"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Subtle Bottom Crease Accents */}
        <path
          d="M6.8 22.2l6-4.8M25.2 22.2l-6-4.8"
          stroke="#0A84FF"
          strokeWidth="1.4"
          strokeOpacity="0.45"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  )
}
