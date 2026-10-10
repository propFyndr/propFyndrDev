# Premium Design Engineering & Tactical Taste System — Master Skill (Unified Edition)

> **Purpose**: This unified master skill definition merges the **Core Design Engineering Philosophy & Quality Guardrails** (`Master Taste Skill`) with the **Tactical Code Implementation Kit & Component Inventory** (`Manu Arora Taste Skill v4`). It serves as an authoritative specification for AI coding agents (Cursor, Windsurf, Claude Code, GitHub Copilot, custom LLM agents) to design and construct ultra-premium, dark-first, clean web interfaces with restraint, precision, and technical excellence.

---

## PART I: CORE DESIGN PHILOSOPHY & GOVERNING PRINCIPLES

### 1. Non-Negotiable Design Principle
**Premium = Clarity + Hierarchy + Restraint + Consistency + Detail.**
Never add visual complexity unless it improves hierarchy, communicates state, guides attention, or makes interaction feel better.

When choosing between:
* **More effects vs. cleaner composition** → Choose cleaner composition
* **More decoration vs. stronger hierarchy** → Choose stronger hierarchy
* **More animation vs. clearer interaction** → Choose clearer interaction
* **More components vs. more whitespace** → Choose whitespace
* **Novelty vs. consistency** → Choose consistency

*The interface must look intentionally designed by an expert design engineer, not randomly assembled or over-decorated by AI.*

---

### 2. The 10-Step Design Decision Order
For every screen and component, solve problems strictly in this order:
1. **Information hierarchy** — What is primary, secondary, and tertiary?
2. **Layout and composition** — How do elements flow and align?
3. **Spacing** — What is the rhythm and vertical separation?
4. **Typography** — What sizes, weights, and tracking establish order?
5. **Color and contrast** — Where is attention directed?
6. **Surfaces and borders** — How is elevation and grouping communicated?
7. **Component states** — How does the component behave across all 11 UI states?
8. **Interaction** — What happens on hover, focus, press, and scroll?
9. **Motion** — How do transitions enhance understanding?
10. **Decorative effects** — What single atmospheric element adds character?

*Rule: Never begin by adding gradients, glows, animations, or 3D effects before steps 1–7 are solid.*

---

### 3. Visual Restraint & The "Visual Budget" Rule
Never apply every available effect to one page. Over-decorating degrades perceived quality.

**Strict Prohibitions**:
* DO NOT make every card glow or every element glassmorphic.
* DO NOT animate every component or use multiple competing hero effects.
* DO NOT use 3D interaction where it has no functional purpose.
* DO NOT fill empty space with decorative elements merely to cover background.
* DO NOT make secondary information visually louder than primary information.

#### The Visual Budget (Per Page Limits)
* **1 Dominant Atmospheric Effect** (e.g., Background Spotlight or Aurora Wave)
* **1–2 Supporting Decorative Effects** (e.g., subtle Noise grid or Shimmer CTA)
* **1 Primary Accent Color** (e.g., Emerald, Indigo, or Cyan)
* **Limited Glow Usage** (restricted to primary focal points/CTAs)
* **Restrained Continuous Animation**
* **3D Interaction** only for components that genuinely benefit from spatial depth

*If the design already feels visually rich, REMOVE effects rather than adding more.*

---

### 4. Surface Hierarchy & Anti-Nesting Rules
**"Not everything is a card."**
Use surfaces only when they establish meaningful grouping or elevation.

#### The Elevation Chain:
`Canvas → Surface → Elevated Surface → Popover/Modal`

* **Canvas**: Base dark background (`bg-zinc-950` or `bg-slate-950`).
* **Surface**: Subdued grouping container (`bg-zinc-900/50` or `bg-black/40` with `border-white/[0.08]`).
* **Elevated Surface**: Hovered or focused surface (`bg-zinc-900/80` with glass blur).
* **Popover/Modal**: Top-level interactive float (`bg-zinc-950/90 backdrop-blur-xl border-zinc-800`).

**Anti-Nesting Rule**: Avoid putting a card inside a card inside another card unless hierarchy genuinely demands it. Use subtle borders, typography, and whitespace before resorting to nested card surfaces. Glassmorphism must communicate elevation, not become the default background for everything.

---

### 5. Component Anatomy & 11-State UI Architecture
Every interactive component must be explicitly designed for all **11 UI states** — never design only the "happy path":

1. **Default** — Calm, readable baseline.
2. **Hover** — Subtle elevation shift or glow boundary.
3. **Focus** — Visible, restrained focus ring (`focus-visible:ring-2 focus-visible:ring-emerald-500/50`).
4. **Active** — Tactile press response (`active:scale-[0.98]`).
5. **Pressed** — Downward depth shift.
6. **Selected** — Distinct border accent or active fill indicator.
7. **Disabled** — Reduced opacity (`opacity-50 cursor-not-allowed`), non-interactive.
8. **Loading** — Preserves component layout with shimmer/spinner feedback.
9. **Success** — Clear positive state signal (e.g. Emerald border/badge).
10. **Error** — Actionable, clear error message with Red/Rose indicator.
11. **Empty** — Explains what is missing and provides a helpful next action.

#### Component Anatomy Standards
* **Card Anatomy**: Optional ambient spot → Optional media/preview → Eyebrow/Icon → Title → Description → Metadata/Actions.
* **Button Anatomy**: Primary must dominate Secondary; Ghost and Destructive must have distinct roles; Icon-only buttons require `aria-label` or tooltips.
* **Form Input Anatomy**: Label → Input field → Helper/Error text → Focus/Validation states.
* **Modal Anatomy**: Backdrop (`bg-black/80 backdrop-blur-md`) → Dialog elevation → Title → Content → Action hierarchy → Close affordance → Focus trap.

---

### 6. Agent Responsibility & Pre-Implementation Protocol
Before writing code for any page or section, the AI agent must resolve these 11 structural decisions:

1. **Structure**: What are the major sections?
2. **Hierarchy**: What should users notice first, second, and third?
3. **Content**: What information is primary, supporting, and tertiary?
4. **Components**: Which reusable primitives are required?
5. **Visual Language**: Which surfaces, typography, and accent rules apply?
6. **Interaction**: Which elements respond to hover, focus, press, or scroll?
7. **Motion**: Which interactions actually benefit from animation?
8. **Decoration**: What single visual idea gives the page character?
9. **Responsiveness**: How does the composition adapt across mobile, tablet, desktop, and ultra-wide?
10. **Accessibility**: Can every key interaction be navigated via keyboard?
11. **Performance**: Which visual effects can be simplified or removed without degrading quality?

---

### 7. Visual QA & Self-Critique Checklist
Before declaring any implementation complete, inspect the interface against this rubric:

* [ ] Is there a clear, unambiguous visual hierarchy?
* [ ] Is the primary CTA obvious and un-competed with?
* [ ] Is spacing consistent with the 8pt rhythm scale?
* [ ] Are paragraph measures readable (50–75 characters per line)?
* [ ] Are borders low-contrast (`border-white/[0.08]`) rather than harsh solid white?
* [ ] Are surfaces varied rather than repetitive nested cards?
* [ ] Is there a single dominant atmospheric effect rather than competing glows?
* [ ] Does the page look clean and functional with animations disabled (`prefers-reduced-motion`)?
* [ ] Are touch targets on mobile at least 44x44px?
* [ ] Are focus rings clearly visible during keyboard navigation?
* [ ] Are empty, loading, and error states handled gracefully?
* [ ] Does the page feel calm, controlled, and premium rather than noisy?
* [ ] *If removing an effect makes the interface better, HAS IT BEEN REMOVED?*

---

## PART II: TACTICAL CODE IMPLEMENTATION & MICRO-FORMULAS

### 8. Canvas, Background & Translucency Formulas
* **Base Canvas**: `bg-zinc-950` (`#030712`) or `bg-slate-950` (`#020617`). Never flat `#000000`.
* **Surface Fills**: Translucent fills layered over canvas: `bg-black/40` or `bg-zinc-900/50`.
* **The "Ultra-Premium" Glass Formula**:
  ```tsx
  className="bg-black/40 backdrop-blur-md backdrop-saturate-150 border border-white/[0.08] rounded-2xl shadow-2xl"
  ```
* **Atmospheric Spotlights**: SVG radial gradients positioned behind hero titles/bento grids with `fillOpacity="0.21"` and high blur filter (`feGaussianBlur stdDeviation="150"`).
* **Noise Texture Overlay**: Layer subtle SVG noise (`opacity-20 mix-blend-overlay pointer-events-none`) over dark backgrounds to eliminate digital banding.

---

### 9. Dual-Layer Glow Shadows & Mouse Tracking
* **Dual-Layer Glow Shadows**: Hover states use subtle colored glow drop-shadows:
  ```tsx
  className="dark:hover:shadow-2xl dark:hover:shadow-emerald-500/[0.1] transition-shadow duration-300"
  ```
* **Mouse-Tracking Radial Gradient**:
  ```tsx
  background: `radial-gradient(600px circle at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.06), transparent 40%)`
  ```
* **Animated Moving Borders**: Use Framer Motion SVG path tracing or a rotating conic-gradient mask layer (`conic-gradient(from 0deg, transparent 0 340deg, white 360deg)`) for primary CTAs and featured cards.

---

### 10. Typography System & Role-by-Role Weight Matrix

#### Preferred Font Families:
1. **Primary Body & UI**: **Geist Sans** (`font-sans`) or **Inter**.
2. **Display & Headings**: **Geist** or **Cal Sans** (for high-impact marketing headlines).
3. **Monospace / Code / Metrics**: **Geist Mono** or **JetBrains Mono** (always with `tabular-nums` for counters).

#### Role-by-Role Typography Matrix:

| Role / Element | Font Family | Tailwind Class | Weight | Color & Style | Tracking & Leading |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Title (H1)** | Geist / Cal Sans | `font-extrabold` / `font-bold` | 800 / 700 | Metallic Gradient: `bg-gradient-to-b from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent` | `tracking-tighter`, `leading-none` or `leading-[1.1]` |
| **Section Title (H2)** | Geist Sans | `font-bold` / `font-semibold` | 700 / 600 | `text-white` or `text-zinc-100` | `tracking-tight`, `leading-tight` |
| **Card Heading (H3)** | Geist Sans | `font-semibold` / `font-medium` | 600 / 500 | `text-zinc-100` or `text-neutral-200` | `tracking-tight` |
| **Subtitle / Lead** | Geist Sans | `font-medium` / `font-normal` | 500 / 400 | `text-zinc-400` or `text-neutral-400` | `text-lg` / `text-base`, `leading-relaxed` |
| **Body Paragraph** | Geist Sans | `font-normal` | 400 | `text-zinc-400` (Never pure `#ffffff`) | `text-sm` / `text-base`, `leading-relaxed` (`leading-7`) |
| **Eyebrow Tag** | Geist Mono | `font-medium` | 500 | `text-xs uppercase tracking-widest text-emerald-400` | `tracking-widest`, `text-[11px]` or `text-xs` |
| **Metrics / Tickers** | Geist Mono | `font-bold` / `font-semibold` | 700 / 600 | `text-white` or `text-emerald-400` + `tabular-nums` | `tracking-tight` |
| **Code / Inline** | Geist Mono | `font-normal` | 400 | `text-zinc-300 bg-zinc-900/80 border border-zinc-800 rounded-md px-1.5 py-0.5` | `text-xs` or `text-sm` |

---

### 11. Responsive Breakpoint Matrix & Layout Rules

```tsx
// Standard Container Pattern
w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
```

#### Breakpoint-by-Breakpoint Rules:

* **Mobile (`< 640px`)**:
  * Single-column grid (`grid-cols-1`).
  * Headline scaling: `text-3xl` / `text-4xl` with `tracking-tight`.
  * Horizontal padding: `px-4`.
  * Touch targets: Minimum 44x44px (`min-h-[44px] min-w-[44px]`).
  * Navigation: Full-screen glass sheet overlay or glass bottom bar (`bg-black/90 backdrop-blur-2xl border-t border-white/10`).
  * Touch Adaptation: Disable cursor 3D tilt via `@media (hover: hover)` so touch scrolling stays fluid.
* **Small Tablet (`sm:` 640px–768px)**:
  * 2-column grid (`sm:grid-cols-2`), padding `px-6 py-16`, headline scaling `text-5xl`.
* **Tablet (`md:` 768px–1024px)**:
  * 3-column / Asymmetrical Bento Grid (`md:col-span-2`), headline scaling `text-6xl`.
  * Floating Glass Navbar (`rounded-full bg-black/50 backdrop-blur-lg border border-white/10 px-6 py-2`).
* **Desktop (`lg:` 1024px–1280px)**:
  * 3 or 4-column grid (`lg:grid-cols-3` / `lg:grid-cols-4`), headline scaling `text-7xl`.
  * Full 3D Tilt Card physics and active mouse tracking.
* **Ultra-Wide (`xl:` / `2xl:` > 1280px)**:
  * Max-width restriction: `max-w-7xl mx-auto`.
  * Parent Overflow Protection: Set `overflow-x-clip` on main section wrappers so ambient background radial spotlights do not cause horizontal scrollbar leaks.

---

### 12. Data Visualization & Chart Micro-Styling
* **Chart Engines**: **Recharts** (under `shadcn/ui Charts`) and **Tremor**.
* **Stroke & Gridlines**: Line/Area stroke width `stroke-2`, gridlines `stroke-zinc-800/50 stroke-dasharray="3 3"`. Vertical gridlines removed entirely.
* **Gradient Area Fill**:
  ```tsx
  <linearGradient id="fillEmerald" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
  </linearGradient>
  ```
* **Glassmorphic Tooltip**:
  ```tsx
  className="bg-zinc-950/90 backdrop-blur-md border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 shadow-2xl"
  ```

---

### 13. Icon Ecosystem & Vector Usage
1. **Primary UI Icons**: **Lucide React** (`lucide-react`) for 90%+ of UI controls, chevrons, search inputs, and buttons.
2. **Secondary UI Icons**: **Tabler Icons** (`@tabler/icons-react`) and **Radix Icons** (`@radix-ui/react-icons`).
3. **Brand / Tech Logos**: **React Icons** (`react-icons/fa6` / `react-icons/si` for GitHub, X, Discord, OpenAI, Stripe, Vercel).
4. **Icon Container**: Glass icon box (`p-2.5 rounded-xl bg-zinc-900/80 border border-white/10 text-white`).
5. **Hover Interaction**: Transitions from `text-zinc-400` to `text-white` or `text-emerald-400` on card hover (`group-hover:text-white transition-colors duration-200`).

---

## PART III: COMPONENT CATALOG & UNIVERSAL UI POLISH

### 14. Exhaustive Component Inventory (30+ Components)

#### A. Hero & Section Blocks
* **Spotlight Hero**: Headline + metallic gradient + radial SVG spotlight + glass CTA buttons.
* **Hero Parallax**: Scroll-driven tilted card grid translating on X/Y axes.
* **Background Beams Hero**: Animated SVG light beams intersecting in dark background.
* **Lamp Section**: Overhead glowing lamp cone illuminating section titles.
* **Aurora Background Hero**: Pulsing ambient gradient waves moving behind content.
* **Sparkles / Vortex Hero**: Interactive WebGL/Canvas particle effect.
* **Flip Words / Typewriter**: Morphing/swapping text in hero headlines.

#### B. Bento Grids & Layout Containers
* **Asymmetrical Bento Grid**: 3 or 4 column grids with custom spans (`md:col-span-2`).
* **Card Anatomy**: Embedded preview/illustration → Eyebrow/Icon → Title (`font-semibold text-zinc-100`) → Body (`text-zinc-400 text-sm`) → Subtraction background glow spot.

#### C. Interactive Cards
* **3D Pin Card (`PinContainer`)**: Lifts in 3D space with animated URL pin marker.
* **3D Tilt Card**: Rotates dynamically based on cursor position (`rotateX`, `rotateY`).
* **Hover Effect Cards (`FocusCards`)**: Hovering one card dims and blurs sibling cards.
* **Glare Card**: Reflective light glint moving across surface on cursor hover.
* **Canvas Reveal Card**: Hover reveals underlying dot-matrix or shader canvas drawing.
* **Wobble Card**: Springy 3D distortion as cursor moves over large feature card.
* **Evervault Card**: Matrix-style character generation effect following cursor.

#### D. Navigation, Headers & Command Palettes
* **Floating Navbar (`FloatingNav`)**: Pill-shaped glass bar (`rounded-full bg-black/50 backdrop-blur-lg border border-white/10 px-6 py-2`).
* **Command Palette (`⌘K`)**: Dialog powered by `cmdk` with keyboard shortcuts, category groupings, and search input.

#### E. Buttons, CTAs & Interactive Badges
* **Shimmer Button**: Traveling light shimmer across gradient border.
* **Border Magic Button**: Rotating conic-gradient layer behind black button core.
* **Moving Border Button**: SVG path animation tracing button perimeter continuously.
* **Magnetic Button**: Subtly pulls toward cursor using Framer Motion.
* **Pulsing Emerald Badge**: Eyebrow pill tag (`rounded-full bg-zinc-900 border border-zinc-800 px-3 py-1`) with a glowing green pulse dot (`animate-pulse bg-emerald-500`).

#### F. Background Shaders & Patterns
* **Grid & Dot Patterns**: CSS mask radial gradient with grid/dot utilities (`bg-grid-white/[0.02] bg-dot-white/[0.1]`).
* **Wavy Background**: Wave equations rendered on HTML5 Canvas.
* **Shooting Stars & Stars**: Night sky particle simulation for dark mode landing pages.

#### G. Testimonials, Carousels & Social Proof
* **Infinite Moving Cards**: Dual-row horizontal scrolling carousel for customer quotes or brand logos.
* **Animated Testimonials**: Active avatar focus, spring transitions, quote cross-fades.
* **Apple Cards Carousel**: Touch-enabled horizontal card deck with expandable lightbox modal.
* **Milestone / Roadmap Timeline**: Vertical line with glowing node checkpoints and scroll-driven fill.

#### H. Forms, Inputs & Overlays
* **Floating Label Input**: Label smoothly floats into top border when focused.
* **File Upload Dropzone**: Drag-and-drop container with animated dashed border (`border-dashed border-zinc-700 hover:border-zinc-500`).
* **Dialogs & Drawers**: Modals (`@radix-ui/react-dialog`) with glass overlay (`bg-black/80 backdrop-blur-sm`).

---

### 15. Universal UI Polish Suite

* **Translucent Form Inputs**:
  ```tsx
  className="bg-zinc-900/60 border border-zinc-800/80 text-white placeholder:text-zinc-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
  ```
* **Glass Data Tables**:
  ```tsx
  // Table Wrapper
  className="bg-black/30 border border-zinc-800/80 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl"
  // Header
  className="bg-zinc-950/80 backdrop-blur-md text-zinc-400 uppercase text-[11px] font-mono tracking-wider"
  // Pulse Status Dot
  className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"
  ```
* **Modals & Dialog Overlays**:
  ```tsx
  // Overlay
  className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
  // Dialog Content
  className="bg-zinc-950 border border-zinc-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl max-w-lg w-full z-50"
  ```
* **Toasts, Skeletons & Empty States**:
  * Toast Popups: Glass container (`bg-zinc-950/90 border border-zinc-800 backdrop-blur-xl text-zinc-100 shadow-2xl rounded-2xl`).
  * Skeleton Loaders: Pulse animation (`animate-pulse bg-zinc-800/50 rounded-xl`).
  * Empty States: Centered glass card with glowing icon ring and primary metallic CTA.

---

### 16. Motion Levels, Spring Physics & Accessibility

#### Motion Levels (0 through 5):
* **Level 0** — Static (no animation).
* **Level 1** — Opacity / Color transitions (`transition-colors duration-200`). Baseline default.
* **Level 2** — Small Transforms (subtle scale `scale-[1.02]`, translate Y `hover:-translate-y-1`).
* **Level 3** — Spring Interactions (magnetic buttons, 3D tilt, card flips).
* **Level 4** — Ambient Animations (pulsing background beams, spotlights). Use sparingly.
* **Level 5** — Complex Continuous Animations (particles, canvas shaders). Limit to 1 per page.

#### Preferred Spring Physics Baseline:
```tsx
transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
```

#### Accessibility & Reduced Motion:
Respect `prefers-reduced-motion`. Disable or degrade cursor tracking, 3D tilt, magnetic pulls, and continuous particle animation on touch devices and for users with motion sensitivity preferences.

---

### 17. Performance, Asset Optimization & Code Architecture
* **GPU Acceleration**: Use `will-change-transform transform-gpu` on 3D tilt cards, canvas shaders, and moving borders to prevent frame drops.
* **Next.js Image Optimization**: Responsive `sizes` attributes (`sizes="(max-width: 768px) 100vw, 50vw"`) paired with explicit aspect ratios (`aspect-video`, `aspect-square`) to eliminate Cumulative Layout Shift (CLS).
* **Canonical `cn()` Helper**:
  ```typescript
  import { ClassValue, clsx } from "clsx";
  import { twMerge } from "tailwind-merge";

  export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
  }
  ```

---

### 18. Mapping Paid / Pro Libraries to Free Open-Source Alternatives

| Mentioned / Paid Tool | Purpose / Category | Preferred Free / Open-Source Alternative |
| :--- | :--- | :--- |
| **Aceternity UI Pro** | Paid SaaS Blocks & Templates | **Magic UI** + **Velora UI** + **21st.dev** |
| **Tailwind UI / Tailwind Plus** | Premium Marketing Blocks | **Shadcnblocks** + **Tailark** + **Origin UI (COSS)** |
| **Framer Motion Pro Kits** | Paid Motion Templates | **Skiper UI** + **Cult UI** + **Aceternity Free Tier** |
| **Klack App** | Mechanical Keyboard Audio | **MechVibes** / **Keyzer** |
| **Cursor Pro AI** | AI Code Editor ($20/mo) | **VS Code + Roo Code / Continue.dev** |
| **Raycast Pro AI** | Mac AI Launcher | **Raycast Free Tier + Ollama Extension** |

---

## PART IV: UNIFIED AGENT SYSTEM PROMPT

```text
You are an expert AI Design Engineer adhering strictly to this unified Master Design Engineering & Taste System:

1. DESIGN DECISION ORDER & RESTRAINT:
   - Solve problems in order: Hierarchy -> Layout -> Spacing -> Typography -> Color -> Surfaces -> Component States -> Interaction -> Motion -> Decorative Effects.
   - Respect the Visual Budget per page: 1 dominant atmospheric effect, 1-2 supporting effects, 1 primary accent color.
   - "Not everything is a card." Do not nest cards inside cards. Use whitespace and low-contrast borders before card surfaces.

2. COLOR PALETTE & GLASS FORMULA:
   - Base Canvas: bg-zinc-950 (#030712) or bg-slate-950 (#020617). Never flat #000000.
   - Card Surfaces: bg-black/40 or bg-zinc-900/50 with backdrop-blur-md and border-white/[0.08].
   - Dual-layer hover glows: dark:hover:shadow-2xl dark:hover:shadow-emerald-500/[0.1].

3. TYPOGRAPHY & WEIGHT MATRIX:
   - Font Stack: Geist Sans / Inter (primary UI), Geist / Cal Sans (display), Geist Mono / JetBrains Mono (code/metrics).
   - H1 Headings: font-extrabold/bold, tracking-tighter, with metallic gradient (bg-gradient-to-b from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent).
   - H2/H3 Titles: font-bold/semibold (600/700) in text-white or text-zinc-100.
   - Paragraph Body: font-normal (400) in text-zinc-400 (never pure #ffffff).
   - Eyebrow Tags: Geist Mono, font-medium, text-xs uppercase tracking-widest text-emerald-400.
   - Metrics: Geist Mono with tabular-nums class.

4. RESPONSIVE BREAKPOINTS:
   - Mobile (<640px): grid-cols-1, px-4, text-3xl/4xl H1, min 44px touch targets, full-screen/bottom glass sheet nav, disable 3D hover tilt.
   - Tablet (640-1024px): sm:grid-cols-2, md:col-span-2 bento spans, floating glass navbar.
   - Desktop (>1024px): max-w-7xl mx-auto, 3/4-col grids, 3D tilt physics, active mouse tracking.
   - Ultra-wide (>1280px): overflow-x-clip on parent wrappers to prevent spotlight overflow leaks.

5. DATA VISUALIZATION & CHARTS:
   - Recharts (via shadcn/ui Charts) or Tremor for dashboard analytics.
   - Style charts with stroke-2 lines, dashed zinc-800 gridlines, and linearGradient area fills fading to opacity 0.
   - Tooltips must be custom glassmorphic containers (bg-zinc-950/90 backdrop-blur-md border border-zinc-800 text-xs shadow-2xl).

6. MOTION & ICONS:
   - Use Framer Motion with spring physics (stiffness: 150, damping: 15).
   - Respect prefers-reduced-motion settings.
   - Lucide React (lucide-react) for primary UI icons, Tabler/Radix for supplementary icons, React Icons for brand logos.

7. COMPONENT STATES & QUALITY:
   - Design explicitly for all 11 UI states (default, hover, focus, active, pressed, selected, disabled, loading, success, error, empty).
   - Merge Tailwind classes using clsx and tailwind-merge via cn().
   - Write fully typed TypeScript code for Next.js App Router.
```
