---
name: chart-graph-master
version: 2.0.0
description: An agent-agnostic master skill for designing, implementing, loading, animating, testing, reviewing, and shipping charts, graphs, KPI metrics, dashboards, and analytical data visualizations across modern web and mobile products. Use it whenever analytics, dashboards, reporting, metrics, graphs, charts, data states, skeletons, counters, transitions, accessibility, responsive behavior, or data-driven motion are being designed or implemented.
---

# Chart & Graph Master Skill

## Mission

Build charts and analytical interfaces that feel like a continuous explanation of the data rather than a pile of numbers that suddenly appears.

The guiding rule is:

> **The user should understand what is loading, what changed, what matters, and where the detail came from without having to decode the interface.**

A chart is not decoration. It is an interface for answering a question.

Every visualization must therefore be designed as a system with five connected layers:

1. **Meaning** — what question the chart answers.
2. **Visual encoding** — how the data is represented.
3. **Context** — labels, units, time range, comparison, annotations.
4. **State** — loading, partial, loaded, empty, stale, filtered, error.
5. **Motion** — how the interface communicates the transition between states.

Do not design the fully loaded chart first and invent the other states afterward. Design the entire state flow at the same time.

---

# 0. Agent Operating Contract

This skill is intended to be consumed by any coding or design agent, including Codex, Claude Code, Cursor-style agents, IDE copilots, or human engineers using an AI coding workflow.

When this skill is active, the agent MUST treat analytics visualization as a complete product system, not as a chart component alone.

## 0.1 Required behavior

Before writing implementation code, the agent must determine:

1. The analytical question the visualization answers.
2. The data shape and units.
3. The expected data density.
4. The loading and refresh model.
5. The interaction model.
6. The accessibility path.
7. The responsive behavior.
8. The motion behavior for initial, update, enter, exit, filter, sort, drill-down, empty, stale, and error states.
9. The rendering technology and animation technology actually needed.
10. The success criteria and QA cases.

If any of these are unknown, make the smallest reasonable assumption from the surrounding product context and state it in the implementation notes. Do not invent business meaning or fabricated data.

## 0.2 Required implementation output

When implementing a chart or analytical module, produce or update all of the following as one coherent system:

```text
Chart specification
Data model / normalized view model
Loading state
Partial state
Loaded state
Refreshing state
Stale state
Empty state
Filtered-empty state
Error state
Responsive rules
Interaction rules
Accessibility rules
Motion rules
Performance rules
QA checklist
```

Do not ship only the loaded visual and defer the other states as “future work.”

## 0.3 Agent anti-pattern

If the request is merely “make the chart look modern,” do not immediately choose colors and animation.

First infer the analytical purpose, then select the visual encoding, then define states, then define motion.

## 0.4 Technology-neutral rule

This skill does not require React, Next.js, SVG, Canvas, D3, Recharts, ECharts, Visx, Chart.js, Motion, GSAP, Anime.js, Framer, or any other library.

The agent must choose the smallest technology stack that satisfies the interaction, rendering, performance, and accessibility requirements.

If the project already has an animation or charting system, prefer extending that system over introducing another library.

# 1. Non-Negotiable Principles

## 1.1 Data first, decoration second

- Choose a chart because it makes the underlying relationship easier to see, not because it looks fashionable.
- Remove visual elements that do not improve interpretation.
- Do not use 3D effects, unnecessary shadows, ornamental gradients, fake depth, glowing data points, or decorative chart frames merely to make a chart look “premium.”
- Use whitespace and hierarchy to make a chart feel premium.
- A good analytical UI often has fewer colors and fewer visible elements than an average one.

## 1.2 The visualization must answer one primary question

Every chart should have a clear job:

- Compare categories.
- Show a trend over time.
- Show a distribution.
- Show a part-to-whole relationship.
- Show correlation.
- Show a hierarchy or flow.
- Show progress toward a target.
- Show geographic distribution.
- Show a single KPI with context.

Do not combine unrelated questions into one visualization merely to save space.

## 1.3 Use progressive disclosure

Show the overview first. Allow detail on demand.

The default hierarchy should usually be:

**headline metric → change/delta → visual trend → relevant context → exact detail on interaction**

Do not force users to open tooltips to learn information that is essential to understanding the chart.

## 1.4 Preserve object continuity

When data changes, the user should be able to see what changed.

Whenever possible:

- Move an existing bar to its new height instead of deleting and recreating it.
- Morph a line to its new path instead of disappearing and redrawing it.
- Keep series colors attached to the same series.
- Keep category order stable unless sorting itself is part of the interaction.
- Keep the same x/y domains during a small update when possible.
- Animate additions and removals separately.

Avoid the pattern:

**old chart → blank → spinner → new chart**

Prefer:

**old chart → controlled transition → new chart**

This is especially important for dashboards with frequently refreshed data.

---

# 2. Chart Selection Master Matrix

Use the simplest visualization that preserves the important relationship.

| User question | Preferred chart | Notes |
|---|---|---|
| “Which category is larger?” | Horizontal bar | Strong for ranking and long labels. |
| “How did this change over time?” | Line | Best for continuous time trends. |
| “How much did each category contribute over time?” | Stacked bar / stacked area | Use carefully; exact comparison becomes harder across stacks. |
| “What is the total magnitude over time?” | Area | Use when filled magnitude adds meaning; do not obscure the baseline. |
| “How are values distributed?” | Histogram / box plot | Use when distribution matters more than individual categories. |
| “Are these two variables related?” | Scatter plot | Add trendline only when analytically justified. |
| “Where are the concentrations?” | Heatmap | Use a sequential or diverging scale with a clear legend. |
| “What percentage comes from each group?” | Stacked bar / donut / pie | Prefer bars when precise comparison matters. |
| “How close are we to a target?” | Bullet / progress / KPI | Use gauge only when the circular form adds actual value. |
| “How did users move through stages?” | Funnel / flow / Sankey-style diagram | Show the sequence and drop-off clearly. |
| “What is the exact value?” | Table / KPI | A chart is not a replacement for exact values. |
| “How are many categories ranked?” | Sorted horizontal bars | Consider Top N + Other for long tails. |
| “What is happening across two dimensions?” | Heatmap | Keep the scale legible and explain the encoding. |

### Chart choice rules

- Prefer bars for direct magnitude comparison.
- Prefer lines for time-based trends.
- Prefer scatter plots for relationships between numerical variables.
- Prefer tables when users need exact values, scanning, copying, or auditing.
- Use pie/donut sparingly and only when part-to-whole is the real question.
- Avoid radar charts unless the comparison is inherently profile-shaped and the audience already understands them.
- Avoid gauges when a number + target + progress bar communicates the same thing more precisely.
- Do not create a second axis simply because two series do not fit together nicely. First ask whether they belong on the same chart at all.
- For many series, use small multiples, filtering, or highlighting instead of a “spaghetti” chart.

These choices align with established guidance from IBM, Apple, Microsoft Power BI, and Tableau: select a visual according to the analytical task rather than variety or decoration.

---

# 3. Chart Anatomy

Every standard analytical chart should be reviewed as a set of independent parts.

## 3.1 Header

Use:

- Concise chart title.
- Optional one-line interpretation or subtitle.
- Date range or selected period.
- Optional filter/control.
- Optional “last updated” timestamp.

The title should describe the subject or insight, not simply repeat the chart type.

Prefer:

**Monthly Revenue**

not:

**Line Chart — Revenue by Month**

When the design benefits from a stronger narrative, a conclusion-oriented title is acceptable:

**Revenue rose 18% over the last 6 months**

The subtitle can then provide the neutral scope and period.

## 3.2 Plot area

The plot should receive the strongest visual priority.

- Data marks should be visually stronger than gridlines.
- Gridlines should support the scale without becoming a texture.
- Axes should explain the scale, not dominate the chart.
- Do not put unnecessary borders around the plot.
- Maximize useful plot width, especially in compact dashboards.

## 3.3 Axes

- Keep axis labels short.
- Include units somewhere obvious.
- Use sensible tick intervals.
- Avoid excessive tick density.
- Use a consistent scale when charts are intended to be compared.
- Do not hide a non-zero baseline in a way that materially changes a bar chart’s perceived magnitude.
- A line chart may use a focused range when that helps reveal a trend, but the scale must remain obvious and must not create a false impression.

## 3.4 Gridlines

Use the minimum density necessary to understand the scale.

Preferred hierarchy:

**data marks > key reference line > axis labels > gridlines**

Use very restrained neutral gridlines. Do not give gridlines the same visual weight as data.

## 3.5 Labels

- Directly label important series or values when this reduces legend hunting.
- Avoid labeling every point when it creates clutter.
- For a few high-value points, labels can replace a tooltip.
- Labels should never overlap important data.
- Do not sacrifice readability to show every possible number.

## 3.6 Legends

Use a legend when direct labels would become crowded.

Keep series colors and legend labels stable between views.

The legend must do real work. Do not include a legend when there is only one obvious series.

---

# 4. Color System for Charts

## 4.1 General color rule

The safest default is:

**mostly neutral interface + one strong data accent + limited semantic colors**

Do not make every series bright.

Color is an attention resource. If everything is loud, nothing is important.

IBM and Tableau both recommend using neutral tones for the visual base and reserving stronger colors for important data, alerts, highlights, and distinctions.

## 4.2 Use the correct palette type

### Categorical / qualitative

Use when categories have no meaningful numeric ordering.

Example:

- Product A
- Product B
- Product C
- Product D

Use visually distinct colors with adequate neighboring contrast.

### Sequential

Use when a single measurement varies from low to high.

Example:

- low sales
- medium sales
- high sales

Use shades of one hue or a carefully related family.

### Diverging

Use when data has a meaningful midpoint.

Example:

- below target
- target
- above target

Use two ends with a clear neutral or midpoint treatment.

### Status / alerts

A common semantic mapping is:

- Green = positive / healthy / success.
- Yellow or amber = warning / attention.
- Orange = serious warning.
- Red = negative / danger / error.
- Neutral = informational or not highlighted.

Do not assume color alone is enough to communicate status.

## 4.3 Color hierarchy

Use this default hierarchy:

1. Primary series or focus item.
2. Secondary series.
3. Comparison/reference series.
4. Muted or historical series.
5. Grid/axis neutrals.

For comparisons, consider showing non-primary series in neutral tones and highlighting only the series the user selected.

## 4.4 Avoid rainbow scales

Do not use rainbow color scales for quantitative data.

Rainbow scales create artificial boundaries and are difficult to interpret consistently.

Use sequential or diverging scales instead.

Carbon specifically recommends sequential and diverging systems for quantitative relationships and discourages using multiple gradients as a replacement for a proper quantitative palette.

## 4.5 Never rely on color alone

If two categories differ only by hue, the visualization becomes fragile for users with color-vision deficiencies and in low-quality displays.

Support important differences with one or more of:

- labels,
- patterns,
- line styles,
- marker shapes,
- position,
- direct annotations,
- icons or status text.

Meaningful graphical objects should meet the applicable WCAG contrast requirements. WCAG 2.2 identifies 3:1 as the minimum contrast for applicable non-text graphical objects and UI components; text has separate requirements.

## 4.6 Recommended generic role tokens

Do not hard-code a universal palette into every product. Map these roles to the product’s brand system and test them for contrast.

```text
chart.primary
chart.secondary
chart.tertiary
chart.reference
chart.muted
chart.positive
chart.warning
chart.negative
chart.neutral
chart.grid
chart.axis
chart.surface
```

A good product design system should define light-theme and dark-theme variants separately.

---


# 4A. Opinionated Visual Defaults

When a product does not already have an established chart design system, start here and then adapt to brand requirements.

```text
Chart line:        2 px
Emphasized line:   3 px
Axis / grid:       1 px, visually subordinate
Primary marker:    6–8 px only when markers are needed
Bar radius:        4–8 px, never so round that bars look like pills
Typical dashboard chart height: 220–320 px
Detail-view chart height:       320–480 px
Default visible gridlines:      about 3–6
Area fill:         subtle, never visually stronger than the line
```

A useful generic light-theme starting palette is:

```text
Primary:   #2563EB
Secondary: #0F766E
Tertiary:  #7C3AED
Muted:     #64748B
Positive:  #15803D
Warning:   #B45309
Negative:  #B91C1C
```

Treat these as starting tokens, not universal truths. Always test against the actual product surfaces and theme. Never use the palette without checking contrast and color-vision accessibility.

For dark themes, generate theme-specific variants instead of simply inverting the light palette.

## 4A.1 Line-chart defaults

- Hide point markers on dense series until hover, focus, or selection.
- Use 2 px as the normal stroke and a slightly heavier stroke for the active series.
- Keep the x-axis calm and use only enough labels to establish the time scale.
- Use a subtle crosshair or guide line on interaction rather than permanent vertical lines for every point.

## 4A.2 Bar-chart defaults

- Keep bars visually solid and easy to compare.
- Use one accent for the main series and neutrals for secondary comparisons when possible.
- Prefer horizontal bars when category labels are long.
- Start magnitude bars from zero unless a different baseline is clearly necessary and non-misleading.

## 4A.3 Area-chart defaults

- Keep the outline stronger than the fill.
- Use area fill as supporting context, not the main signal.
- Avoid multiple opaque filled series that visually merge.

# 5. Number Formatting

Numbers are part of the visualization, not an afterthought.

## 5.1 Format for scanning

Prefer compact notation when precision is not the point.

Examples:

- 3.4M instead of 3,400,000
- 12.6K instead of 12,600
- 7.2% instead of 7.23841%

Preserve precision when the decision actually depends on it.

## 5.2 Be consistent

Do not show:

- 12.5K in one card
- 12,500 in the next
- 12.50k in another

unless there is a clear reason.

Keep precision, units, abbreviations, and decimal formatting consistent within a dashboard.

## 5.3 KPI anatomy

A strong KPI card normally contains:

**Metric label**

**Primary value**

**Delta / comparison**

**Time period or basis**

**Optional sparkline or context**

Example:

```text
Monthly Revenue
₹18.4L
↑ 12.8%
vs last month
```

Do not show a naked number such as `18,42,731` without telling the user what it represents.

## 5.4 Delta formatting

The delta must show both direction and amount.

Examples:

- ↑ 12.8%
- ↓ ₹42K
- +182 orders

Never use color alone to communicate the direction.

---

# 6. Chart Interaction

The default interaction model is:

**overview first → zoom/filter → details on demand**

This principle is directly supported by IBM’s data visualization guidance.

## 6.1 Hover / focus

On desktop:

- Highlight the hovered data point or category.
- Dim irrelevant series if it improves focus.
- Show a compact tooltip near the data point.
- Add a vertical/horizontal guide line when useful.
- Never make the tooltip the only route to essential information.

On mobile:

- Replace hover with tap or press.
- Use touch-friendly target sizes.
- Allow the selected state to remain visible until dismissed or another point is selected.

## 6.2 Tooltip anatomy

A useful tooltip can include:

```text
April 2026
Revenue        ₹18.4L
Orders          1,284
vs March        +8.2%
```

Keep it concise. Do not place a full report inside a tooltip.

## 6.3 Filtering

Filters should:

- be easy to discover,
- show the current selection,
- update related charts consistently,
- preserve context,
- avoid unnecessary full-screen loading,
- maintain chart geometry when possible.

If a filter changes the chart, animate the change instead of flashing a blank container.

## 6.4 Highlighting

Clicking a legend series should preferably toggle visibility or isolate the selected series.

Do not permanently alter the base color meaning.

## 6.5 Zoom / brush

Use only when the dataset is dense enough to justify it.

A zoom interaction should preserve the user’s position and explain the new range.

Do not add zoom merely because the chart library provides it.

## 6.6 Drill-down

Use drill-down when the higher-level visualization benefits from additional detail.

The transition should preserve the user’s spatial context whenever possible.

---

# 7. The Motion System

Motion exists to explain change, hierarchy, cause and effect, and continuity.

The best chart animation is not the one with the most effects. It is the one that makes the data easier to understand.

IBM’s current motion guidance emphasizes purpose, precision, rhythm, controlled attention, consistent movement, and reduced complexity for dense visualizations.

## 7.1 The “flow” model

For an analytical screen, the preferred sequence is:

```text
1. Page/surface is stable
2. Component skeletons appear where data belongs
3. Static structure resolves
4. KPI values count or transition into place
5. Chart geometry reveals
6. Series settle into their final state
7. Secondary labels/context appear
8. Interaction becomes available
```

Do not make every step equally dramatic.

The motion should feel like one coherent system.

## 7.2 Animation priorities

Use motion in this order of importance:

1. Explain data change.
2. Explain navigation/state change.
3. Confirm user interaction.
4. Establish hierarchy.
5. Add polish.

If an animation cannot be assigned to one of these jobs, remove it.

## 7.3 Recommended timing tokens

Use these as starting points, not rigid laws:

```text
micro:       100–160 ms
standard:    160–280 ms
emphasis:    280–500 ms
chart reveal: 350–700 ms
KPI count:   500–900 ms
complex sequence: keep under ~1.2 s unless the process itself is longer
```

Frequent UI transitions should stay short. Material’s motion guidance explicitly recommends keeping transitions fast enough not to create waiting while still making the change understandable.

## 7.4 Easing

Default toward:

- ease-out for elements entering or settling into place,
- ease-in for elements leaving,
- ease-in-out for reversible state changes,
- restrained springs where a physical response adds meaning.

Do not use bounce everywhere.

A dashboard is usually information-dense. Information-dense interfaces need calmer motion than marketing pages.

## 7.5 Stagger

Use staggered timing when it helps the eye follow a sequence.

Good:

```text
KPI 1 → KPI 2 → KPI 3 → chart → supporting text
```

Bad:

```text
KPI 1 + KPI 2 + KPI 3 + chart + tooltip + icons + background
all moving at once
```

Use small offsets between related elements. The goal is rhythm, not delay.

## 7.6 Single-axis movement

Prefer motion that uses one main axis or a clear transform.

Avoid chaotic diagonal movement, random rotations, excessive parallax, and multiple simultaneous depth changes.

## 7.7 Animate the data, not the frame

For charts:

- Bars grow from the baseline.
- Line charts reveal the path or interpolate between points.
- Scatter points fade/scale into their coordinates.
- Donut arcs interpolate their angle/length.
- Heatmap cells appear with restrained opacity or value transitions.
- KPI numbers interpolate between values.

Do not rotate an entire chart card into view or bounce the whole dashboard merely to reveal a graph.

---

# 8. Chart-Specific Animation Recipes

## 8.1 KPI card

Sequence:

```text
label: already visible or fades in
value: 0 → target
change: fade/slide into place
sparkline: draw/reveal after the value begins
```

The value should visually resolve before secondary information takes attention.

## 8.2 Bar chart

Use:

```text
baseline → bars grow to actual values
```

For categorical ranking:

- keep category labels stationary,
- grow bars from zero,
- stagger slightly only when helpful,
- sort before animation starts,
- avoid bars racing across the screen.

When values update, interpolate from the previous height to the new height rather than restarting from zero.

## 8.3 Line chart

Initial render:

- reveal the line from left to right or interpolate points in sequence,
- optionally reveal markers after the path settles,
- keep grid and axes mostly static.

On update:

- morph the existing path,
- preserve visible continuity,
- animate only the changed segment when practical.

Do not redraw the line from the origin every time live data changes.

## 8.4 Area chart

Treat the line as the primary geometry and the fill as secondary.

Avoid making the entire area pulse or flash.

For updates, morph the top boundary and let the fill follow it.

## 8.5 Donut / pie

Use restrained angle interpolation.

Do not spin the chart through multiple rotations.

For selected segments, slightly separate or brighten the segment instead of using large explosive motion.

## 8.6 Scatter plot

Do not make hundreds of points bounce in simultaneously.

For dense datasets:

- reveal progressively,
- use opacity or scale transitions,
- highlight the relevant point after the dataset is stable,
- avoid per-point heavyweight JavaScript animation.

## 8.7 Heatmap

For initial load, a restrained opacity/value reveal is usually enough.

For filter changes, interpolate cell values or crossfade carefully. Do not repeatedly animate the entire grid with large motion.

## 8.8 Stacked charts

Preserve stack order.

Do not allow segments to swap positions during an update unless the reordering itself is the purpose.

Use direct labels or a strong legend when exact segment identity matters.

---

# 9. KPI Number Animation

The user should never stare at an unchanged placeholder while the interface has already established that a value is coming.

The preferred initial sequence is:

```text
Skeleton → 0 / neutral placeholder → animated target value
```

For example:

```text
0
↓
184
↓
1,240
↓
12,843
```

The motion should settle smoothly on the real value.

## 9.1 Important exception

Do not force every number to start from zero.

Starting from zero is appropriate for a newly revealed cumulative KPI when the effect clearly means “building toward the loaded total.” It is not automatically appropriate for:

- account balance,
- current temperature,
- time,
- rank,
- percentage that represents a current state,
- a delta between two states,
- a live value where the previous number is already known.

For these, animate from a meaningful prior state or reveal the final value directly.

## 9.2 Updating values

Prefer:

```text
12,843 → 13,114
```

over:

```text
12,843 → 0 → 13,114
```

The second approach destroys continuity.

## 9.3 Counter implementation guidance

In React, Motion’s `animate()` and Motion Values can update a displayed counter without causing a React render for every intermediate frame. This is a strong pattern for frequently updated counters.

Conceptual pattern:

```tsx
const count = useMotionValue(0)
const rounded = useTransform(count, latest => Math.round(latest))

useEffect(() => {
  const controls = animate(count, target, {
    duration: 0.7,
    ease: "easeOut"
  })

  return () => controls.stop()
}, [target])

return <motion.span>{rounded}</motion.span>
```

Use the library’s current API rather than copying old Framer Motion examples that import from outdated package names. Current Motion documentation uses `motion/react` and identifies Motion as the successor to Framer Motion.

---

# 10. Loading and Skeleton Master Rules

## 10.1 Never show an unexplained blank analytics surface

A blank dashboard can look broken.

Use a skeleton when the content will take long enough to matter and the final structure is already known.

NN/G recommends skeletons for loading interfaces where the wait is long enough to be perceived and specifically warns against “frame-only” skeletons that do not represent the actual content structure.

MUI similarly recommends content-shaped skeletons because they make the interface feel immediately responsive and allow information to appear incrementally.

## 10.2 Skeletons must match the final geometry

The skeleton should reserve roughly the same space as the loaded element.

For a chart card, the skeleton can include:

```text
chart title bar
small period/filter bar
plot rectangle
axis label placeholders
legend placeholders if needed
```

For a KPI card:

```text
label skeleton
large value skeleton
delta skeleton
sparkline skeleton if applicable
```

Do not use one generic rectangle for everything.

## 10.3 Every independently loaded element gets an independent skeleton

This is a hard implementation rule.

If the dashboard contains:

- 4 KPI cards,
- revenue chart,
- orders chart,
- inventory table,
- activity feed,

then each independently loaded region should have its own loading state.

Do not wait for the slowest API call before rendering the fast parts.

Prefer:

```text
KPI 1 → loaded
KPI 2 → loaded
KPI 3 → skeleton
KPI 4 → loaded
Revenue → loaded
Orders → skeleton
Inventory → skeleton
Feed → loaded
```

This is the “incremental interface” pattern commonly seen in large content products.

## 10.4 YouTube/Instagram-style skeleton behavior

Use these products as behavioral references rather than visual copies.

A content-platform skeleton typically:

- reserves the final layout,
- represents the actual shape of content,
- avoids a blank page,
- allows pieces to resolve progressively,
- keeps the user oriented to where content will appear.

A YouTube-like implementation would use a thumbnail-shaped skeleton plus title/metadata lines rather than one full-page spinner.

An Instagram-like implementation would keep feed/story/profile geometry visible while text, images, avatars, and secondary information resolve progressively.

The important lesson is not the exact colors or shapes. It is the **continuity of layout and progressive replacement of placeholders with real content**.

## 10.5 Skeleton animation

Use a subtle pulse or shimmer only to communicate that the content is still loading.

The animation must:

- be low contrast,
- avoid flashing,
- move slowly enough to feel calm,
- not compete with already-loaded content,
- stop when the content is ready.

Do not make a skeleton brighter than the loaded chart.

## 10.6 Skeleton delay and fast responses

Do not flash skeletons for extremely fast requests.

Where appropriate, use a short threshold before showing a skeleton so a request that resolves almost instantly does not create:

```text
real content → skeleton flash → real content
```

This is a practical perceived-performance optimization.

## 10.7 Preserve old data during refetch

If the user is looking at valid old data and a background refresh starts:

**keep the old data visible**

and show a subtle refresh indicator.

Do not replace a meaningful loaded chart with a skeleton merely because it is refreshing.

Use a skeleton for the first meaningful load; use stale-while-refreshing behavior for subsequent background updates when product requirements allow it.

---

# 11. Full Analytics State Machine

Every analytical component should support at least these states:

```text
idle
loading
partial
loaded
refreshing
empty
filtered-empty
error
stale
```

## 11.1 Loading

Show a geometry-matched skeleton.

## 11.2 Partial

Render the data that is already available.

Keep remaining regions in skeleton state.

## 11.3 Loaded

Render the full visualization.

Run only the initial reveal animation once.

## 11.4 Refreshing

Keep useful old data visible when valid.

Add:

- subtle spinner or progress indicator near the source/control,
- “Updating…” microcopy when the refresh is long enough to notice,
- last-updated timestamp where appropriate.

## 11.5 Empty

A valid empty dataset is not an error.

Explain what “empty” means.

Example:

**No sales yet**

Connect a store or complete your first order to see revenue here.

Do not render axes for meaningless zero-data charts unless the axes help explain what will eventually appear.

## 11.6 Filtered empty

Differentiate:

**No data exists**

from:

**No data matches your current filters.**

Give the user a direct path to clear or change filters.

## 11.7 Error

Show:

- what failed,
- whether previous data is still valid,
- a retry action when useful.

Do not turn an API error into a generic blank card.

---

# 12. Modern Dashboard Layout

A dashboard should read like a hierarchy, not a wall of cards.

A strong default sequence is:

```text
Page title + global controls
↓
Headline KPIs
↓
Primary trend / business signal
↓
Supporting comparisons
↓
Breakdowns / tables / operational detail
```

Put the highest-value information where the user naturally starts reading.

Microsoft Power BI’s dashboard guidance similarly emphasizes highlighting the most important information, keeping the page focused, and avoiding unnecessary clutter.

## 12.1 KPI row

Use only the KPIs that help the user understand the page’s purpose.

Do not create 14 KPI cards just because 14 metrics exist.

## 12.2 Primary chart

One chart should normally act as the visual anchor for the page.

Supporting charts should answer the next questions a user naturally has.

## 12.3 Repeated chart language

Across the same product:

- same axis style,
- same title hierarchy,
- same tooltip pattern,
- same date-range control,
- same status colors,
- same series colors,
- same loading pattern,
- same motion timings.

A dashboard should feel like one analytical system.

---

# 13. Responsive Chart Rules

## Desktop

Take advantage of horizontal space for:

- longer category labels,
- more readable time-series plots,
- legends placed near the plot,
- side-by-side comparisons.

## Tablet

Reduce:

- tick density,
- visible series count,
- supporting labels.

## Mobile

Do not simply shrink the desktop chart.

Instead:

- simplify axes,
- reduce tick count,
- use horizontal bars for long category labels,
- allow horizontal scrolling when the x-axis genuinely needs more room,
- move filters into compact controls,
- use tap-based detail interaction,
- expose exact values through an accessible detail view or table.

Avoid tiny unreadable labels merely to preserve the desktop composition.

---

# 14. Accessibility Rules

Accessibility is part of the chart, not a final QA add-on.

## 14.1 Color

- Do not rely on hue alone.
- Test chart marks against their backgrounds.
- Test important adjoining graphical regions.
- Maintain sufficient non-text contrast according to the relevant WCAG criteria.

WCAG 2.2 identifies 3:1 as the threshold for applicable meaningful graphical objects and UI components under Non-text Contrast.

## 14.2 Motion

Respect:

```css
@media (prefers-reduced-motion: reduce) {
  /* remove or reduce non-essential motion */
}
```

For reduced motion:

- remove large translations,
- remove parallax,
- reduce spring bounce,
- shorten or eliminate decorative reveals,
- keep essential state changes understandable without motion.

W3C identifies `prefers-reduced-motion` as an established technique, and Apple recommends reducing automatic/repetitive movement when the system preference is enabled.

## 14.3 Charts must have an alternate information path

Provide one or more of:

- accessible chart summaries,
- screen-reader-readable data,
- a table view,
- descriptive labels,
- accessible tooltips or focus states.

Apple’s chart guidance explicitly emphasizes fully accessible charts and supports accessible descriptions and data exploration.

## 14.4 Keyboard interaction

Any chart interaction that reveals information on hover must have an equivalent focus/keyboard path when the platform supports keyboard interaction.

Never design a “hover-only” analytical workflow.

## 14.5 Flashing

Do not create rapid flashing or attention-grabbing loops.

WCAG contains explicit protections around flashing content. Avoid anything that approaches those thresholds.

---

# 15. Motion Libraries: Which Tool Does What?

## 15.1 Framer

Use Framer primarily for:

- visual prototyping,
- interaction exploration,
- reusable components,
- component variants,
- appear/hover/press/scroll interactions,
- validating motion behavior before implementation.

Framer’s current animation system is powered by Motion and supports component effects, variants, scroll interactions, and accessibility settings.

Use Framer to define the intended motion language before developers hard-code the interaction.

## 15.2 Motion.dev / Motion for React

This should be the default code-level choice for React interfaces when the animation is part of the interface system.

Current Motion guidance supports:

- `motion.*` components,
- variants,
- enter/exit animation,
- `AnimatePresence`,
- layout animations,
- shared-layout transitions with `layoutId`,
- gestures,
- `whileInView`,
- `useScroll`,
- Motion Values,
- `useSpring`,
- imperative `animate()`.

Use it for:

- KPI counters,
- card/state transitions,
- chart reveals,
- tooltip motion,
- filter transitions,
- layout changes,
- shared UI elements,
- controlled microinteractions.

Prefer declarative Motion for normal React UI. Use imperative `animate()` or Motion Values when high-frequency numeric updates need finer control.

## 15.3 Anime.js

Use Anime.js when you want direct control over:

- timelines,
- staggered sequences,
- SVG animation,
- text animation,
- draggable interactions,
- custom DOM/SVG sequences,
- lower-level animation utilities.

Anime.js is a good fit for custom data-visualization effects when React component state does not need to own every frame.

Do not introduce Anime.js into a project that already has a clean Motion-based system unless the additional capability is actually needed.

## 15.4 GSAP

Use GSAP when the project needs:

- complex timelines,
- long multi-stage sequences,
- sophisticated SVG animation,
- `Flip`-style state transitions,
- ScrollTrigger,
- precise timeline control,
- highly bespoke animation choreography.

GSAP’s Timeline model is especially useful when many animations need coordinated sequencing, overlap, labels, seeking, reversing, or dynamic timing.

For a normal admin dashboard, GSAP may be more capability than necessary. Use it when the interaction actually benefits from that control.

## 15.5 CSS / Web Animations API

Use CSS or WAAPI first for:

- opacity transitions,
- simple transforms,
- hover states,
- focus states,
- skeleton shimmer,
- simple loading pulses,
- small component transitions.

The Web Animations API is a native browser animation model and is useful when JavaScript orchestration is unnecessary.

## 15.6 D3 and chart libraries

Do not confuse chart rendering with interface animation.

A chart engine should primarily own:

- scales,
- axes,
- geometry,
- marks,
- data binding,
- interaction primitives.

A motion library should primarily own:

- component state transitions,
- staged reveals,
- counters,
- shared UI movement,
- choreography.

If the chart library already performs the required transition cleanly, do not layer a second animation system on top of it.

---

# 16. Recommended Technical Pattern

For React/Next.js products, prefer this architecture:

```text
Data source
    ↓
Data normalization
    ↓
Chart model / view model
    ↓
Chart renderer
    ↓
Motion orchestration
    ↓
Tooltip / interaction layer
    ↓
Accessible alternate representation
```

Each analytical widget should ideally expose explicit state:

```ts
type AnalyticsState<T> = {
  status:
    | "idle"
    | "loading"
    | "partial"
    | "loaded"
    | "refreshing"
    | "empty"
    | "filtered-empty"
    | "error"
    | "stale"
  data?: T
  error?: unknown
  updatedAt?: string
}
```

The UI should render from state rather than relying on incidental loading behavior.

---

# 17. Performance Rules

A beautiful graph that drops frames is not a polished graph.

## Prefer

- CSS transforms for simple movement.
- Opacity and transform for inexpensive UI transitions.
- Motion Values for high-frequency values when appropriate.
- SVG for crisp, scalable analytical graphics when the dataset is suitable.
- Canvas or specialized rendering for very large point clouds when necessary.
- Memoized chart models.
- Stable keys for series and data points.
- Virtualization for very large tables/lists.
- Incremental data loading.
- Background refresh instead of destructive refetching.

## Avoid

- unnecessary React renders for every counter frame,
- animating thousands of DOM nodes independently,
- animating expensive blur/filter effects during scrolling,
- animating layout properties when transform can express the same movement,
- restarting an entire chart animation whenever one value changes.

Motion’s current engine can use native browser animation capabilities where possible and falls back to JavaScript for capabilities that need it. Use that advantage by keeping animation scoped and purposeful.

---

# 18. The “Never Do This” List

Never:

- show a blank dashboard while waiting for multiple independent APIs,
- replace valid stale data with a skeleton during every refresh,
- animate every dashboard element at once,
- make every chart colorful,
- use color alone for meaning,
- use rainbow gradients for quantitative data,
- use 3D charts for serious analytics,
- rotate pie charts dramatically,
- reset live numbers to zero on every update,
- make tooltips the only source of important information,
- use hover-only interactions,
- hide important information behind filters,
- make gridlines stronger than data,
- show every possible label by default,
- use a second axis merely to fit unrelated series together,
- use gauges just because they look “dashboard-like,”
- use skeletons for a process that needs a real progress indicator,
- create a frame-only skeleton with no representation of actual content structure,
- allow skeleton animation to continue after content has loaded,
- ignore reduced-motion preferences,
- add a motion library when CSS can solve a simple transition,
- introduce multiple animation libraries without a defined reason,
- allow chart motion to change the perceived meaning of the data.

---

# 19. Standard Data-Reveal Sequence

Use this as the default analytical reveal choreography.

## Phase 1 — Immediate structure

Show the page shell immediately.

Show headers, filters, card containers, and known labels that do not depend on data.

## Phase 2 — Independent skeletons

Each data region gets its own content-shaped skeleton.

## Phase 3 — Fast content wins

Render whichever data arrives first.

Do not block the whole page for the slowest widget.

## Phase 4 — Headline metric

Animate the primary number into place.

## Phase 5 — Primary chart

Reveal the primary series.

## Phase 6 — Context

Reveal delta, comparison, labels, and annotations.

## Phase 7 — Interaction

Activate hover, tap, filter, zoom, drill-down, and details-on-demand.

## Phase 8 — Background refresh

Keep the current data visible while new data arrives when valid.

This creates a perceived story of progress:

**“The page exists → the data is arriving → here is the answer → here is the trend → here is the detail.”**

---

# 20. Example Dashboard Motion Timeline

For a dashboard entering the viewport:

```text
0 ms       page shell is already stable
0–120 ms  KPI labels / chart titles settle
80–300 ms KPI values animate toward final values
180–520 ms primary chart marks reveal
320–620 ms deltas and annotations appear
420–700 ms secondary chart content settles
```

These are starting values, not mandatory timings.

The visual rhythm should feel continuous rather than theatrical.

---

# 21. Skeleton Specification Template

When implementing a new chart component, define its skeleton explicitly.

```text
Chart: RevenueTrend

Loaded structure:
- title
- date range
- KPI summary
- plot
- x-axis
- y-axis
- legend
- tooltip

Loading structure:
- title skeleton
- date-range skeleton
- KPI value skeleton
- KPI delta skeleton
- plot skeleton
- axis skeletons
- legend skeleton

States:
- loading
- partial
- loaded
- refreshing
- empty
- filtered-empty
- error

Motion:
- KPI count-up on initial reveal
- line path reveal on first load
- old-to-new interpolation on refresh
- reduced-motion fallback

Accessibility:
- chart summary
- exact values available
- keyboard/focus interaction
- no color-only meaning
```

This template should be applied to every analytical module.

---

# 22. Chart QA Checklist

Before shipping any chart, verify:

### Meaning

- Is the question obvious?
- Is the chosen chart type appropriate?
- Can the user understand the conclusion without a tutorial?

### Visual hierarchy

- Is the data stronger than the grid?
- Is there a clear primary signal?
- Is the chart free of unnecessary decoration?

### Scale

- Are axes truthful and understandable?
- Are units clear?
- Are tick labels readable?
- Are comparable charts using compatible scales?

### Color

- Is color used intentionally?
- Is the palette appropriate for categorical/sequential/diverging data?
- Can the chart still be understood without hue alone?
- Have meaningful graphics been contrast-tested?

### Number formatting

- Are units consistent?
- Is precision appropriate?
- Are large numbers easy to scan?
- Is the delta explained?

### Motion

- Does motion explain change?
- Does the initial reveal have a clear order?
- Do live updates interpolate from the previous state?
- Is the motion short enough that it never makes the user wait?
- Does reduced motion work?

### Loading

- Is there a meaningful skeleton?
- Does the skeleton match final geometry?
- Does each independently loaded element have its own state?
- Does fast data avoid unnecessary skeleton flashing?
- Does background refresh preserve useful old data?

### Interaction

- Does hover have a touch/focus equivalent?
- Are tooltips concise?
- Are filters understandable?
- Is important information visible without interaction?

### Accessibility

- Is there an accessible summary or alternate representation?
- Can important values be reached without color or hover?
- Does the chart behave acceptably under reduced motion?

### Performance

- Are unnecessary frames/renders avoided?
- Are animations scoped to the elements that actually change?
- Is the animation implementation proportional to the problem?

---

# 23. Prompting Rules for an AI Coding Agent

When asking an AI coding agent to build an analytical UI, do not say only:

> “Make the dashboard charts look modern.”

Instead provide the required behavior explicitly.

Use this structure:

```text
Build the analytics module using the Chart & Graph Master Skill.

1. Identify the analytical question for each visualization.
2. Choose the simplest appropriate chart type.
3. Define the loaded, loading, partial, refreshing, empty, filtered-empty, stale, and error states.
4. Give each independently loaded region its own geometry-matched skeleton.
5. Use a restrained neutral-first chart palette with semantic color roles.
6. Make the data marks visually stronger than axes and gridlines.
7. Animate initial KPI values into place.
8. Animate chart geometry as data geometry, not as decorative card motion.
9. On data updates, interpolate from the previous data instead of resetting to zero.
10. Use Motion for React for normal React UI animation unless another tool has a clear technical advantage.
11. Respect prefers-reduced-motion.
12. Make hover information available through focus/tap equivalents.
13. Keep exact values accessible through labels/tooltips/table/detail views.
14. Avoid unnecessary animation libraries and avoid duplicate animation systems.
15. Test desktop, tablet, mobile, slow network, empty data, filtered empty, error, and reduced-motion states.
16. Do not use blank loading screens or frame-only skeletons.
17. Keep all animation purposeful, short, and consistent.
18. Do not invent data or change the analytical meaning to make the visual prettier.
```

When the agent returns an implementation, require it to report:

- chart type and why,
- color roles,
- loading behavior,
- motion behavior,
- accessibility behavior,
- responsive behavior,
- refresh behavior,
- performance considerations.

---

# 24. Design-System Tokens to Standardize Across Products

A mature product should define shared analytics tokens rather than reinventing charts screen by screen.

Suggested system:

```text
Analytics/Typography
- chart.title
- chart.subtitle
- chart.axis
- chart.tick
- chart.value
- chart.tooltip
- chart.annotation

Analytics/Color
- categorical.1 … categorical.n
- sequential.low … sequential.high
- diverging.negative … diverging.mid … diverging.positive
- status.success
- status.warning
- status.danger
- status.info

Analytics/Motion
- reveal.fast
- reveal.standard
- reveal.emphasis
- chart.initial
- chart.update
- counter.initial
- hover.enter
- hover.exit
- filter.update

Analytics/State
- skeleton.surface
- skeleton.highlight
- stale.indicator
- empty.surface
- error.surface
```

Once standardized, the entire product gains a consistent analytical language.

---

# 25. Reference Benchmarks

Use the following systems as reference points when making design decisions:

- **Apple Human Interface Guidelines — Charts:** strong hierarchy, compact chart anatomy, accessible charts, concise labeling.
- **IBM Design Language / Carbon — Data Visualization:** chart selection, color systems, interaction, motion, hierarchy, contextual detail.
- **Microsoft Power BI guidance:** dashboard hierarchy, visualization choice, number formatting, scales, labels, and reducing clutter.
- **Tableau Visual Best Practices:** neutral-first dashboards, purposeful highlight colors, palette consistency, and accessibility.
- **W3C WCAG 2.2:** non-text contrast, use of color, reduced motion, flashing and accessibility requirements.
- **Motion.dev:** current React animation APIs, Motion Values, counters, layout animation, gestures and scroll-linked motion.
- **Framer:** visual component effects, variants, scroll/appear interactions, accessibility-aware motion settings.
- **Anime.js:** timeline, SVG, text and stagger animation capabilities.
- **GSAP:** timeline sequencing, precise control, Flip, ScrollTrigger and complex choreography.
- **Nielsen Norman Group — Skeleton Screens 101:** skeleton selection, wait-time behavior, progressive content structure and the problems with frame-only skeletons.
- **MUI Skeleton guidance:** content-shaped placeholders and incremental replacement of loaded content.

---

# 26. Final Principle

The goal is not to make charts move.

The goal is to make **data change understandable**.

A polished analytics experience should feel like this:

```text
The interface appears
        ↓
The structure is already understandable
        ↓
The system shows exactly where information is coming
        ↓
Fast pieces resolve immediately
        ↓
Important numbers settle into place
        ↓
The chart reveals the relationship in the data
        ↓
The user can inspect details without losing context
        ↓
Updates flow from the old state to the new state
```

**Never animate because animation is available. Animate because the movement explains something.**

**Never use a skeleton because the screen is loading. Use it because the structure is known and worth communicating before the content arrives.**

**Never show a chart because a dashboard needs a chart. Show it because the visual encoding answers a real question better than plain text or a table alone.**

---

## Research basis

This skill was synthesized from current guidance and documentation available in September 2026, including Apple Human Interface Guidelines, IBM Design Language and Carbon Design System, Microsoft Power BI, Tableau, W3C WCAG 2.2, Motion.dev, Framer, Anime.js, GSAP, Nielsen Norman Group, MUI, and web.dev.


# 27. Data Integrity & Statistical Truth Rules

A chart can be visually beautiful and analytically wrong. The agent must protect the meaning of the dataset before styling or animating it.

## 27.1 Never invent a value for a missing observation

Distinguish explicitly between:

```text
0       = measured zero
null    = no observation / missing
unknown = source did not provide a usable value
N/A     = concept does not apply
suppressed = value intentionally hidden or redacted
```

Do not silently convert `null` into `0`.

For a time series, missing observations should normally produce a visible gap or an explicitly explained missing-data treatment rather than an invented connecting segment.

## 27.2 Missing-data behavior

Choose one of these intentionally:

- show a gap,
- show an explicit missing marker,
- connect values only when the business definition says interpolation is valid,
- impute only when the analytical method explicitly defines the imputation.

If interpolation is used, disclose that it is interpolated.

## 27.3 Outliers

Do not remove, clamp, winsorize, or visually hide outliers just to make the chart look cleaner.

If outliers are intentionally excluded for an analytical reason, show the exclusion in the UI or supporting notes.

## 27.4 Aggregation

A chart must make its aggregation understandable.

Examples:

```text
Revenue = SUM(order revenue)
Users = COUNT(DISTINCT user_id)
Conversion = completed / eligible
Average order value = revenue / orders
```

Do not label a metric “Users” when it is actually sessions, events, or rows.

## 27.5 Percentages and rates

Every percentage should have a known denominator.

Examples:

```text
Conversion rate = converted users / eligible users
Return rate = returned orders / fulfilled orders
```

Do not compare percentages that use different denominators without explaining the basis.

## 27.6 Derived metrics

For every derived metric, know:

- numerator,
- denominator,
- filters,
- time window,
- timezone,
- aggregation logic,
- rounding rule.

## 27.7 Sampling and partial data

When only a subset of a dataset is displayed:

- state the subset size where relevant,
- show “Top 10,” “sample,” or equivalent wording,
- do not visually imply completeness.

## 27.8 Uncertainty

When uncertainty is part of the data, visualize it rather than hiding it.

Possible encodings:

- confidence intervals,
- error bars,
- bands,
- ranges,
- quantile bands,
- min/max envelopes.

Do not use an uncertainty visual if the underlying uncertainty has no defined statistical meaning.

## 27.9 Comparability

Two visual values are only comparable when they share the relevant:

- unit,
- time basis,
- population,
- aggregation,
- scale,
- denominator.

Do not create visual comparisons that look valid but mix incompatible definitions.

---

# 28. Scale & Axis Master Rules

## 28.1 Choose a scale based on the data

Possible scales include:

- linear,
- logarithmic,
- time,
- ordinal/category,
- percentage,
- diverging around a meaningful midpoint.

Never use logarithmic scaling without making the transformation discoverable.

## 28.2 Baseline rules

For magnitude bars:

- default to zero baseline,
- keep the baseline visible through the scale when it matters,
- do not use a truncated baseline to exaggerate small differences.

For line charts, a zero baseline is not mandatory when it makes the trend hard to inspect, but the scale must remain clear and honest.

## 28.3 Tick generation

Ticks should be:

- evenly spaced according to the scale,
- easy to parse,
- sufficiently sparse,
- stable across comparable charts.

Prefer familiar intervals such as:

```text
1, 2, 5, 10 × powers of ten
```

Avoid arbitrary intervals when a standard sequence is available.

## 28.4 Domain stability

During small live updates, do not continuously re-scale the y-axis for every minor movement unless the product genuinely requires a dynamic viewport.

Constant rescaling makes stable data look like large movement.

A useful rule:

```text
small update → preserve domain
large meaningful range change → animate domain change carefully
```

## 28.5 Domain animation

When an axis domain must change:

1. preserve the existing chart when possible,
2. interpolate the scale,
3. interpolate the marks using the same scale transition,
4. avoid a sudden jump in the axis followed by a separate jump in the marks.

The axis and data should feel like one transformation.

## 28.6 Dual axes

Avoid dual-axis charts by default.

Use them only when:

- the two measures have a meaningful relationship,
- the scale differences are unavoidable,
- the mapping is extremely clear,
- the audience can correctly interpret the two scales.

Prefer separate small multiples when that is clearer.

## 28.7 Log scales

Use log scales only when:

- values span orders of magnitude,
- the audience can understand the transformation,
- zero/negative values are not being misrepresented.

Never silently apply log scaling.

## 28.8 Baseline and gridline animation

Avoid animating gridlines independently from the data except when the scale itself is changing.

Static context + moving data is generally easier to understand than a fully moving frame.

---

# 29. Chart-Type Master Recipes

These are default recipes. Override them only for a documented analytical reason.

## 29.1 Line chart

Use for ordered continuous sequences, especially time.

Default:

- 2 px primary stroke,
- markers hidden until interaction for dense data,
- subtle grid,
- direct labeling for a small number of series,
- crosshair on interaction,
- preserve point identity during updates.

Avoid:

- extreme smoothing that changes the perceived path,
- decorative curves unrelated to the data,
- dozens of simultaneously highlighted series.

## 29.2 Step line

Use when the value changes in discrete steps and the hold duration is meaningful.

Do not use smooth interpolation where the data semantics are stepwise.

## 29.3 Bar chart

Use for comparison and discrete quantities.

Animation:

```text
baseline → target height/width
```

Update:

```text
old value → new value
```

If sorted order changes:

```text
old position + old size
        ↓
position transition + size transition
        ↓
new sorted state
```

Do not let labels teleport while bars move.

## 29.4 Lollipop chart

Use when bars would be visually heavy and values are sparse.

Avoid when precise comparison between many categories is required.

## 29.5 Stacked bar

Use for part-to-whole over categories or periods.

Keep stack order stable.

Anchor the segment that matters most when possible, because only the first segment has a constant baseline in a standard stack.

## 29.6 100% stacked bar

Use only for composition percentages, not absolute magnitude.

Always make the distinction from ordinary stacked bars explicit.

## 29.7 Area chart

Use when cumulative magnitude or volume itself matters.

Do not use a filled area simply because it “looks premium.”

## 29.8 Donut / pie

Use when there are few categories and part-to-whole is the main question.

Rules:

- avoid many slices,
- sort intentionally,
- show the total when useful,
- label important slices directly,
- never require angle estimation for an exact decision.

## 29.9 Treemap

Use for hierarchical part-to-whole at multiple levels when area encoding is useful.

Do not use treemaps when users need accurate comparison between similar values.

## 29.10 Scatter plot

Use for relationship, clusters, and outliers.

If point density is high:

- reduce opacity,
- aggregate or bin when appropriate,
- use density/hexbin plots when that better represents the structure.

## 29.11 Bubble chart

Use a size dimension only when area encoding is acceptable for the analytical task.

Never use bubble area when exact comparison is the primary task.

## 29.12 Histogram

Choose a meaningful bin strategy.

Do not change bin width arbitrarily between equivalent views because it can alter the story.

## 29.13 Box plot

Use when distribution, quartiles, median, and outliers matter.

Do not replace a distribution with an average alone.

## 29.14 Violin plot

Use when the shape of the distribution matters and the audience understands density representation.

## 29.15 Heatmap

Use for matrix relationships.

Make the scale legend explicit.

Use a diverging palette only when there is a meaningful midpoint.

## 29.16 Calendar heatmap

Use for day-level activity or frequency patterns.

Keep weekday and month context easy to read.

## 29.17 Bullet chart

Prefer for compact target-versus-actual comparisons.

Show:

```text
actual
reference target
qualitative range if meaningful
```

## 29.18 Progress chart

Use for completion against a known goal.

Always label the denominator when it matters:

```text
7 / 10 tasks
70%
```

## 29.19 Funnel

Use for an ordered sequence with stage drop-off.

Do not use a funnel where stages are not sequential or when width has no meaningful interpretation.

## 29.20 Waterfall

Use when explaining how sequential positive and negative contributions produce a final total.

The starting and ending totals must remain visually clear.

## 29.21 Sankey / flow

Use for movement between sources and destinations.

Use restrained animation and allow the user to pause or disable it when flow motion is persistent.

## 29.22 Geographic map

Use maps only when location itself matters.

Do not use a map to show ordinary categorical data just because location is available.

## 29.23 Sparkline

Use for compact trend context.

A sparkline is not a substitute for the full chart when exact scale or interpretation matters.

## 29.24 Table + chart hybrid

Use when the user needs both pattern recognition and exact values.

For operational dashboards, a chart often answers “what is happening?” while a table answers “which exact records caused it?”

---

# 30. Annotation, Callouts & Explanatory Context

A strong chart tells the user what matters without hiding the underlying data.

## 30.1 Annotation hierarchy

Use this hierarchy:

1. title,
2. subtitle / scope,
3. direct annotation of the important change,
4. reference line or target,
5. tooltip detail,
6. deep explanation elsewhere.

## 30.2 Annotate events

If a visible change is caused by a known event, annotate it when the event is relevant to interpretation.

Examples:

```text
Campaign launched
Price changed
Feature released
Store opened
Policy changed
```

Do not annotate every tiny movement.

## 30.3 Reference lines

Use reference lines for:

- targets,
- averages,
- thresholds,
- benchmarks,
- medians.

Make the reference visually subordinate to the primary data.

## 30.4 Callout behavior

A callout should appear close to the point it explains and should not cover the important marks.

On responsive layouts, reposition callouts instead of allowing overlap.

## 30.5 Avoid misleading narrative labels

Do not write “Huge growth” when the actual increase is 2%.

Prefer factual wording:

```text
+2.0% vs previous period
```

---

# 31. Motion Vocabulary: Every Beat You May Need

Treat motion as a controlled vocabulary. Each beat has a purpose.

## 31.1 Structural settle

Purpose: establish the page skeleton.

Properties:

- opacity,
- small translate,
- no aggressive scale.

Use once per route/view, not on every data refresh.

## 31.2 Skeleton presence

Purpose: communicate “content is coming.”

Properties:

- low-contrast pulse or shimmer,
- no bouncing.

## 31.3 Data reveal

Purpose: communicate first arrival of actual data.

Properties depend on chart type:

- bar length/height,
- line path,
- area boundary/fill,
- point position/opacity,
- arc extent,
- cell value.

## 31.4 Metric settle

Purpose: make the important number feel resolved.

Use a counter only when progression toward the value adds meaning.

## 31.5 Supporting-detail reveal

Purpose: introduce deltas, labels, annotations, or secondary metrics without competing with the primary result.

## 31.6 Hover focus

Purpose: identify the exact mark under the pointer/focus.

Good effects:

- marker scale 1.0 → 1.1,
- line width 2 px → 2.5–3 px,
- opacity emphasis,
- tooltip fade/translate.

Avoid:

- large jumps,
- color flashing,
- layout shifts.

## 31.7 Press feedback

Purpose: confirm selection.

Use subtle scale or opacity rather than bouncing the entire chart.

## 31.8 Crosshair reveal

Purpose: provide a common x/y reference for exact inspection.

Animate in quickly and remove quickly.

## 31.9 Filter transition

Purpose: show that the dataset changed because of a user action.

Prefer:

```text
old data → transform/interpolate → new data
```

Use crossfade only when object identity cannot be preserved.

## 31.10 Sort transition

Purpose: make category reordering understandable.

Use position interpolation so users can follow each category.

## 31.11 Enter

New data marks should enter from the semantic origin when appropriate.

Example:

```text
new bar = 0 height → target height
```

## 31.12 Update

Existing data marks should transition from old values to new values.

## 31.13 Exit

Removed marks should leave intentionally.

Possible techniques:

- fade,
- shrink toward a semantic origin,
- move out with the sorted position.

Do not abruptly delete a meaningful mark if continuity matters.

## 31.14 Live point arrival

For a newly arrived time-series point:

1. append the point,
2. interpolate its geometry,
3. optionally apply a one-time subtle highlight,
4. remove the highlight naturally.

Never leave new-point pulsing running forever.

## 31.15 Tooltip transition

Keep tooltip movement attached to the cursor/data context without excessive chasing.

Use spring-like smoothing when the tooltip follows a moving crosshair.

## 31.16 Legend selection

On selecting a series:

- emphasize selected series,
- mute other series,
- preserve series identity.

Do not recolor the meaning of the selected series.

## 31.17 Drill-down

Preserve spatial relation where possible.

A category becoming its detail view is better represented by a controlled transition than a hard page flash.

## 31.18 Drill-up

Reverse the path or otherwise preserve the parent-child relationship.

## 31.19 Refresh beat

For background refresh:

```text
current data stays visible
        ↓
subtle “updating” state
        ↓
new values interpolate in
```

Do not restart the initial reveal.

## 31.20 Empty beat

Do not animate an empty chart as if it contains data.

Use a calm empty-state transition:

```text
skeleton → empty explanation
```

## 31.21 Error beat

Prefer:

```text
current/partial content
        ↓
error state appears near the affected region
```

Avoid a dramatic full-screen failure animation for a single widget.

## 31.22 Resize beat

Do not replay the full chart intro because the viewport changed.

Recompute geometry and preserve state.

## 31.23 Theme switch beat

For light/dark mode changes:

- transition colors carefully,
- preserve geometry,
- do not replay chart data reveals.

## 31.24 Reduced-motion beat

Replace spatial movement with:

- instant position changes,
- short opacity transitions,
- explicit state changes,
- no parallax,
- no long path-drawing sequences.

## 31.25 Persistent/looping motion

Use infinite animation only when it communicates an active process, such as a skeleton or data stream.

Looping motion should never become decorative noise on an analytical dashboard.

---

# 32. Motion Properties: What to Animate and What Not to Animate

## 32.1 Preferred properties

Prefer properties that are cheap and semantically clear:

```text
opacity
transform: translate / scale
clip-path when appropriate
SVG pathLength / stroke-dash behavior
SVG geometry attributes when the renderer requires them
color/backgroundColor for short state transitions
```

## 32.2 Use layout animation carefully

Animating width/height/top/left can trigger expensive layout work depending on implementation.

For ordinary UI transitions, prefer transform where possible.

For chart geometry, however, changing a bar’s actual geometric height can be semantically correct. The chart renderer may need to update geometry directly; do not distort the data just to avoid a layout calculation.

## 32.3 Avoid animating blur for routine charts

Blur is visually expensive and rarely adds analytical meaning.

Use it only for a clearly justified transition, and never as the default chart reveal.

## 32.4 Avoid giant scale-in effects

A chart should not feel like a marketing hero card.

Do not scale an entire chart from 0.7 → 1 as the primary data reveal.

Reveal the data geometry instead.

## 32.5 Avoid random motion

Randomness can create a feeling that the data itself is unstable.

Analytical motion should be deterministic and tied to a known state change.

---

# 33. Motion Timing System

Timing is a system, not a collection of arbitrary numbers.

Use project tokens when available. Otherwise start with:

```text
instant                  0–80 ms
micro                    80–160 ms
fast                     140–220 ms
standard                 180–300 ms
emphasis                 280–450 ms
chart initial            400–700 ms
counter initial           500–900 ms
complex coordinated      700–1200 ms
```

These ranges are starting points. The interaction should still feel immediate.

## 33.1 Duration by purpose

```text
hover state          100–180 ms
press state            80–140 ms
tooltip enter         120–200 ms
filter response       180–400 ms
bar update            250–500 ms
line update           250–500 ms
initial chart reveal  400–700 ms
KPI count             500–900 ms
layout transition     180–350 ms
```

Do not make a 20 ms database refresh look like an 800 ms event.

## 33.2 Stagger formula

Stagger should remain bounded.

A useful starting pattern:

```text
stagger = min(baseStagger, maxTotal / itemCount)
```

For example, do not use 120 ms × 50 data points and accidentally create a six-second reveal.

## 33.3 Stagger direction

Choose a meaningful order:

- left → right for chronological time series,
- top → bottom for ranked lists,
- center → outward for radial structures when appropriate,
- source → destination for flows.

The animation order should reinforce the reading order.

## 33.4 Avoid delay stacking

Do not add:

```text
page delay
+ card delay
+ chart delay
+ series delay
+ point delay
+ tooltip delay
```

until the interface becomes sluggish.

Prefer a shared timeline or carefully coordinated overlapping beats.

---

# 34. Easing Master Rules

## 34.1 Default mapping

```text
enter / reveal       ease-out
exit                 ease-in
state change         ease-in-out
physical UI response spring
numeric interpolation linear-ish or ease-out
```

## 34.2 Springs

Springs are useful when the object should feel physically attached to a moving source, such as:

- tooltip tracking,
- drag interactions,
- shared layout transitions,
- pointer-following indicators.

Do not use spring bounce for every KPI or bar chart.

## 34.3 No bounce for serious analytics by default

A bouncing number can suggest playfulness rather than clarity.

Use overshoot only when the product’s visual language supports it and the movement does not reduce legibility.

---

# 35. Chart Update Algorithms

The agent should implement chart updates according to data identity.

## 35.1 Key data points by identity

A mark should have a stable key based on its semantic identity, for example:

```text
seriesId + timestamp
seriesId + categoryId
entityId
```

Do not key solely by array index when items may be inserted, removed, or sorted.

## 35.2 Enter / update / exit model

Every data refresh conceptually becomes:

```text
previous dataset
   ↓
identity join
   ├── enter
   ├── update
   └── exit
```

Animate each branch separately.

## 35.3 Stable identity beats visual tricks

The best bar-chart sort animation is not a fancy effect. It is correct identity preservation.

## 35.4 When to crossfade

Use crossfade or hard swap when:

- the data definition changed,
- category identities are incompatible,
- scale transformation is too large to interpret as a direct movement,
- the user intentionally switched to an unrelated metric.

Forced interpolation can imply a false relationship between unrelated states.

## 35.5 Filter changes

When a filter narrows the same metric:

- preserve surviving marks,
- animate removed marks out,
- animate newly visible marks in,
- re-scale carefully.

When the filter changes the metric semantics entirely, use a clear transition between chart states rather than pretending it is the same dataset.

## 35.6 Sorting

Sorting is one of the highest-value chart animations because it preserves category identity while the order changes.

Use:

```text
old y-position → new y-position
old length     → new length if value also changed
```

Animate labels with the same spatial transition.

---

# 36. KPI System: Beyond the Counter

## 36.1 KPI anatomy

A KPI should normally answer four questions quickly:

```text
What is it?
What is the current value?
What changed?
Compared with what?
```

## 36.2 Primary value animation

For initial load:

```text
skeleton → meaningful starting state → target
```

A zero start is acceptable only when the number behaving like a count-up communicates value construction.

## 36.3 Currency

Do not animate currency with excessive decimal flicker.

Prefer:

```text
₹0 → ₹1,250 → ₹12,500
```

rather than rapidly swapping arbitrary decimal values that are impossible to read.

## 36.4 Percentages

For percentages, consider:

```text
0% → 42.6%
```

but use a direct reveal or old-to-new interpolation when a zero start would imply an accumulation that did not occur.

## 36.5 Negative deltas

When the target is negative, preserve sign and semantic direction.

Do not animate `-12%` through a visually confusing unsigned sequence.

## 36.6 Rank changes

Ranks are ordinal states, not cumulative quantities.

Prefer:

```text
#7 → #4
```

with a direct transition or list movement rather than:

```text
0 → 1 → 2 → 3 → 4
```

unless the intermediate progression has actual meaning.

## 36.7 Live metric updates

For a current metric:

```text
previous value → latest value
```

Use a subtle positive/negative delta cue. Do not replay a full count-up on every polling cycle.

---

# 37. Skeleton Masterclass: Geometry, Ownership & Timing

## 37.1 Skeletons are layout contracts

A skeleton is not fake data.

It is a promise about where data will appear.

Therefore the skeleton must reserve the final geometry closely enough that the loaded state does not cause a layout jump.

## 37.2 One async owner, one state

If a chart title depends on one request and the chart data depends on another, model them as separate states where practical.

Do not lock the whole module to the slowest dependency when the UI can progressively resolve.

## 37.3 Skeleton anatomy by component

### KPI

```text
label skeleton
value skeleton
comparison skeleton
optional sparkline skeleton
```

### Line chart

```text
title skeleton
control skeleton
y-axis ticks / labels
plot geometry placeholder
legend if required
```

### Bar chart

```text
title
category labels
bar silhouettes of representative heights
axis
```

The skeleton should preserve the rough visual density of the eventual chart without pretending to know exact values.

### Table

Use repeated row geometry:

```text
header
row 1
row 2
row 3
...
```

Do not show only one giant rectangle where a table will appear.

## 37.4 Skeleton geometry should be deterministic

Do not randomize skeleton bar heights on every mount.

A deterministic skeleton is easier to scan and avoids making users wonder whether the placeholders are actual data.

## 37.5 Skeleton animation selection

Use:

```text
no animation → very fast loads
pulse         → calm content loading
wave          → content placeholders where a sweeping cue is helpful
```

The exact implementation may use CSS, native browser animation, MUI, or another component system.

## 37.6 Skeleton accessibility

Loading state should be communicated programmatically where appropriate.

Do not make an infinite shimmer the only signal to assistive technology.

Use accessible busy/status semantics according to the application framework and platform.

## 37.7 Skeleton-to-content transition

Prefer replacement with minimal geometry change.

Do not animate the skeleton out and the full chart in as two unrelated full-screen effects.

Good:

```text
skeleton opacity ↓
data opacity ↑
geometry stays stable
```

Better for some charts:

```text
skeleton plot remains
actual marks appear inside the same reserved geometry
```

## 37.8 Skeleton flash prevention

For fast requests:

```text
request starts
     ↓
short threshold
     ↓
if still unresolved → skeleton
```

Do not show a skeleton for a request that resolves before it can be meaningfully perceived.

---

# 38. Progressive Loading Patterns Inspired by Content Products

Use YouTube and Instagram as behavioral references for progressive loading, not as visual templates.

The transferable principles are:

```text
reserve layout
show content-shaped placeholders
resolve independent pieces independently
keep scroll/context stable
avoid full-screen blocking when only one region is slow
```

## 38.1 Feed-like analytics

For long analytics pages:

- render the page shell,
- render visible KPI/chart skeletons,
- load above-the-fold content first,
- load lower-priority modules as needed,
- avoid forcing the user to wait for every below-the-fold request.

## 38.2 Viewport priority

When performance matters, prioritize what the user can currently see.

Potential order:

```text
visible KPIs
visible primary chart
visible filters
secondary above-fold modules
below-fold modules
heavy detail views
```

## 38.3 Preserve scroll position

Loading content must not cause the page to jump unexpectedly.

Reserve layout dimensions and use stable containers.

## 38.4 Independent failure

One failed analytics widget should not make every other widget display an error state.

Use local failure boundaries where the product architecture allows them.

---

# 39. Interaction Masterclass

## 39.1 Pointer hover

Hover should clarify, not perform the primary analytical task.

Use it for:

- exact values,
- series focus,
- contextual details,
- temporary guides.

## 39.2 Keyboard focus

Every interactive chart element that can be reached by pointer should have an accessible keyboard or assistive-technology equivalent where applicable.

## 39.3 Touch

Do not assume `hover` exists.

Provide:

- tap,
- long press when justified,
- persistent selected state,
- clear dismissal or replacement behavior.

## 39.4 Scrubbing

Scrubbing is highly effective for time-series charts.

Use a large interaction surface so users do not need to hit tiny dots.

Show:

```text
selected date/time
selected series values
crosshair / guide
```

## 39.5 Tooltip anchoring

Tooltips must:

- remain within viewport bounds,
- avoid covering the point when possible,
- reposition near edges,
- work on touch,
- stay readable at large text sizes.

## 39.6 Selection persistence

After selection, the chosen data should remain visually identifiable.

Do not make the interface require the user to keep the pointer perfectly stationary.

## 39.7 Hover throttling

For very dense charts, do not fire expensive state updates for every pointer event.

Prefer requestAnimationFrame or the animation system’s high-frequency primitives when necessary.

---

# 40. Responsive & Container Rules for Charts

## 40.1 Measure the chart container, not the viewport

Chart geometry should respond to its actual available width and height.

Do not hard-code desktop dimensions into responsive charts.

## 40.2 Avoid re-running intro animations on resize

Resize means geometry recalculation, not a new story.

## 40.3 Mobile simplification

On mobile, selectively remove or transform:

- secondary series,
- dense axis ticks,
- permanent legends,
- low-value annotations.

Preserve the analytical meaning.

## 40.4 Mobile horizontal scrolling

Use horizontal scroll when the time sequence genuinely needs more width.

Make the scroll behavior obvious and preserve the y-axis context where possible.

## 40.5 Responsive legend

Possible strategies:

- direct labels for 1–3 series,
- compact legend for a few series,
- selectable legend sheet/popover on mobile,
- “More” grouping for long category lists.

## 40.6 Responsive tooltips

Touch tooltips can use a bottom sheet or anchored detail surface if a point-level tooltip is too fragile.

Do not shrink desktop tooltips until the text becomes unreadable.

---

# 41. Accessibility Masterclass

## 41.1 Accessible summary

Every important chart should have a concise textual summary that communicates:

- what the chart measures,
- the time or scope,
- the main values or trend,
- any important caveat.

## 41.2 Exact-value path

Users must have a path to exact values without requiring:

- color perception,
- hover,
- pointer precision,
- animation observation.

Use labels, data tables, accessible summaries, keyboard focus, or equivalent platform APIs.

## 41.3 Do not describe colors as meaning

For assistive technology, describe the semantic series name rather than “the blue line.”

## 41.4 Avoid subjective trend words

Prefer exact statements over:

```text
rapid growth
almost flat
huge decline
```

Use:

```text
+18% over 6 months
```

or a similarly objective description.

## 41.5 Focus indicators

Interactive chart states must have a visible focus indicator that is not lost against the plot.

## 41.6 Reduced motion

Support the platform/user preference.

Motion.dev provides `useReducedMotion()` and a `MotionConfig reducedMotion="user"` pattern for adapting or disabling transform/layout motion while retaining non-problematic state changes where appropriate.

## 41.7 High contrast

Check charts with:

- high-contrast themes,
- grayscale,
- reduced brightness,
- simulated color-vision differences,
- large text settings.

## 41.8 Data table fallback

For complex or dense charts, a “View data” or accessible table path can be the most reliable non-visual alternative.

---

# 42. Color System Masterclass v2

## 42.1 Use semantic roles, not arbitrary hex values

Define roles:

```text
primary-series
secondary-series
muted-series
comparison
benchmark
positive
negative
warning
info
missing
selection
hover
grid
axis
surface
```

## 42.2 Default philosophy

Start with:

```text
neutral foundation
+ one dominant accent
+ restrained secondary colors
+ semantic status colors only when meaning exists
```

This keeps analytical screens calm and prevents color competition.

## 42.3 Categorical series assignment

Use colors that remain distinguishable adjacent to one another.

Do not use arbitrary brand colors if two neighboring series become visually indistinguishable.

Carbon maintains curated categorical palettes specifically to maximize accessibility and neighboring contrast.

## 42.4 Sequential data

Use increasing lightness or a controlled perceptual ramp.

Do not use unrelated hues for low/medium/high values unless the color changes encode a meaningful qualitative boundary.

## 42.5 Diverging data

Use a clear midpoint.

Typical conceptual mapping:

```text
negative ← neutral midpoint → positive
```

Do not use diverging palettes for ordinary single-direction magnitude.

## 42.6 Selection state

Selection should be visible through at least two cues when possible:

- color emphasis,
- line weight,
- opacity,
- marker shape,
- outline,
- text label.

## 42.7 Missing data

Missing values should use a distinct neutral treatment and, when important, a label or pattern.

Do not make missing values resemble real zero values.

## 42.8 Dark mode

Do not simply invert the light theme.

Re-test:

- contrast,
- line visibility,
- grid strength,
- semantic colors,
- tooltip surfaces,
- selection states.

---

# 43. Performance Architecture Masterclass

## 43.1 Rendering choice

Choose based on data size and interaction complexity.

```text
small / moderate SVG chart
large point cloud → consider Canvas / GPU / specialized renderer
simple UI transition → CSS / WAAPI
React UI orchestration → Motion for React
complex timeline → GSAP / Anime.js where justified
```

## 43.2 Do not animate 10,000 DOM nodes

For large datasets:

- aggregate,
- bin,
- decimate appropriately,
- use canvas/WebGL or specialized rendering,
- animate only meaningful aggregates.

## 43.3 Decimation must preserve meaning

Do not downsample a series using a naive “take every nth point” rule when that could remove meaningful peaks or troughs.

Use a method appropriate to the analytical goal, such as preserving extrema or using a documented decimation approach.

## 43.4 Memoization

Memoize:

- normalized data,
- scales,
- derived statistics,
- chart geometry,
- expensive formatter functions.

Do not recompute the full chart model on every hover event.

## 43.5 Separate data updates from pointer updates

A pointer movement over a chart should not cause unrelated dashboard components to re-render.

Use local state or animation primitives where appropriate.

## 43.6 Offload heavy work

For expensive aggregation/processing:

- pre-aggregate on the server when practical,
- cache derived queries,
- use workers for heavy client-side computation when needed.

## 43.7 Avoid layout thrashing

Do not repeatedly read layout and write layout in the same tight loop.

Batch measurements and updates.

## 43.8 Frame budget

Treat 60 fps as a useful target for ordinary interactions, while recognizing that actual frame budgets vary by device and workload.

When a transition cannot maintain acceptable smoothness, reduce work instead of merely changing the easing curve.

---

# 44. Library Selection Matrix

## Motion for React / Motion.dev

Best default for:

- React UI state changes,
- counters,
- layout transitions,
- tooltips,
- selected states,
- enter/exit,
- SVG attributes,
- scroll-linked effects,
- reduced-motion-aware interfaces.

Current Motion documentation exposes `motion.*`, `useMotionValue`, `useSpring`, `useReducedMotion`, layout animation, and `animate()`. `useMotionValue` updates can avoid React re-renders for every intermediate frame, which is useful for animated counters and other high-frequency values.

## Framer

Use for:

- interactive visual prototyping,
- motion experimentation,
- page/component transition exploration,
- validating the motion hierarchy before implementation.

Do not treat a Framer prototype as the complete technical specification. The implementation still needs explicit loading, data identity, accessibility, and performance rules.

## Anime.js

Use for:

- explicit timelines,
- SVG sequences,
- staggered multi-target animation,
- custom DOM/SVG choreography,
- lower-level animation orchestration.

Anime.js supports timeline positioning, `stagger()`, SVG morphing, and Web Animations API workflows.

## GSAP

Use for:

- complex multi-stage timelines,
- precise sequencing and control,
- SVG draw/morph effects,
- advanced scroll-linked choreography,
- large animation compositions.

GSAP Timelines support sequencing, overlap, seeking, reversing, and direct playback control; DrawSVG and MorphSVG support specialized SVG transitions.

## CSS / WAAPI

Preferred for:

- simple hover states,
- opacity/transform transitions,
- skeletons,
- tiny state changes,
- lightweight effects.

Do not add a JavaScript animation dependency for a transition that CSS can handle cleanly.

## Chart library / D3

Let the charting layer own:

- scale calculation,
- geometry,
- axes,
- data joins,
- mark creation,
- chart-specific interactions where already supported.

Add a motion library when it improves orchestration, state transitions, or interaction quality. Avoid duplicate transition engines fighting over the same properties.

---

# 45. Motion Implementation Patterns for Coding Agents

## 45.1 Counter pattern

Use a dedicated animated value rather than setting React state on every frame.

Conceptual React pattern:

```tsx
const value = useMotionValue(0)
const rounded = useTransform(value, latest => Math.round(latest))

useEffect(() => {
  const controls = animate(value, target, {
    duration: 0.7,
    ease: 'easeOut',
  })
  return () => controls.stop()
}, [target, value])

return <motion.span>{rounded}</motion.span>
```

Use a suitable formatter instead of `Math.round` for currency, percentages, decimals, compact notation, and locale-aware numbers.

Motion documents Motion Values as stateful, composable values that can update rendered output without triggering React re-renders for each intermediate frame.

## 45.2 Line reveal pattern

Possible techniques:

```text
SVG pathLength
stroke-dasharray / stroke-dashoffset
renderer-specific reveal API
```

Current Motion `animate()` supports SVG path progress via `pathLength`, `pathSpacing`, and `pathOffset`.

GSAP DrawSVG can progressively reveal SVG strokes and is useful when more specialized stroke control is required.

## 45.3 Tooltip spring pattern

Use a spring when a tooltip or crosshair follows a moving point and the response should feel attached to that point.

Do not use a large spring bounce.

Motion’s `useSpring` can track another motion value and smoothly follow its target.

## 45.4 Layout / reorder pattern

Use layout animation when the semantic object remains the same but its spatial arrangement changes.

Motion supports `layout` for automatic layout changes and `layoutId` for shared element transitions.

For chart marks whose geometry is controlled by a charting engine, prefer the chart engine’s data transition or a dedicated geometry animation rather than forcing a UI layout animation abstraction onto the marks.

## 45.5 Timeline pattern

Use one orchestrated sequence rather than scattered delays.

Conceptually:

```text
labels
  └─→ KPI
       └─→ primary chart
            └─→ context
                 └─→ interaction
```

GSAP Timeline and Anime.js timelines both support explicit sequencing and relative timing; choose one when the sequence is genuinely complex.

---

# 46. Initial Load, Refresh, Filter, Sort & Drill-Down State Matrix

| Event | Preserve | Animate | Avoid |
|---|---|---|---|
| First load | layout | skeleton → data | blank screen |
| Fast first load | layout | minimal/no skeleton | skeleton flash |
| Background refresh | old valid data | old → new | old → skeleton |
| Filter same metric | surviving marks | geometry/position | hard reset |
| Sort | item identity | position | label teleport |
| New category | context | enter | sudden pop |
| Removed category | context | exit | silent disappearance |
| Metric change | controls/context | clear state transition | fake continuity |
| Drill-down | parent context | related transition | hard flash |
| Resize | data/state | geometry only if needed | replay intro |
| Theme switch | data/state | palette transition | data replay |
| Error in one widget | other widgets | local error state | whole-page failure |

---

# 47. Data Density Rules

## Low density

Example: 7 daily points.

You may show:

- markers,
- direct labels,
- rich interaction,
- annotations.

## Medium density

Example: 30–180 points.

Use:

- fewer markers,
- hover/focus details,
- selective labels,
- aggregation when necessary.

## High density

Example: thousands of points.

Prioritize:

- overview,
- density/aggregation,
- zoom,
- brushing,
- outlier selection,
- performance.

Do not attempt to label or animate every point.

## Very high density

Use:

- bins,
- heatmaps,
- density plots,
- canvas/WebGL,
- progressive level-of-detail rendering.

---

# 48. Formatting & Localization Masterclass

Analytics may be viewed in different locales, currencies, numbering conventions, and time zones.

## 48.1 Currency

Do not hard-code one currency symbol into a reusable chart component.

Use locale-aware formatting.

## 48.2 Number separators

Support locale-specific separators where appropriate.

## 48.3 Dates

Avoid ambiguous dates such as:

```text
06/07/26
```

when locale context is unclear.

Prefer a clear form such as:

```text
7 Jun 2026
```

or a locale-aware formatted date.

## 48.4 Time zones

Analytics must define the timezone used for aggregation.

A “daily” chart can mean local calendar days, UTC days, or account timezone days. Do not silently mix them.

## 48.5 Compact notation

Use:

```text
1.2K
3.4M
```

only when the loss of precision is acceptable.

Provide exact values in tooltip/table/detail views.

## 48.6 Rounding consistency

A dashboard should use the same rounding conventions across related widgets.

---

# 49. Empty, Stale, Partial & Error Copy Rules

## Empty

State what is empty and why it matters.

```text
No orders yet
Orders will appear here after your first sale.
```

## Filtered empty

```text
No orders match these filters.
Clear filters
```

## Stale

When stale data is still useful:

```text
Updated 14 min ago
Updating…
```

Do not label healthy cached data as an error merely because it is old.

## Partial

Make partial completion understandable:

```text
Revenue loaded
Inventory still loading
```

## Error

Prefer local and actionable:

```text
Revenue could not be loaded
Retry
```

Avoid exposing raw stack traces to ordinary users.

---

# 50. Analytics UX Copy Rules

Chart copy should be plain, factual, and compact.

Prefer:

```text
Revenue
Orders
Conversion rate
vs last month
Last updated 2:14 PM
```

Avoid:

```text
Amazing Revenue Performance!!!
Super Powerful Growth Insights
```

## 50.1 Explain scope

When useful, include:

- period,
- population,
- location,
- segment,
- source,
- denominator.

## 50.2 Explain unusual data

If a metric has an expected discontinuity, annotate it rather than allowing the user to assume the system malfunctioned.

---

# 51. Dashboard Composition Masterclass

## 51.1 Page hierarchy

A strong default:

```text
Page title / controls
        ↓
KPI summary
        ↓
primary business signal
        ↓
comparisons / breakdowns
        ↓
operational detail / table
```

## 51.2 Card count

Do not create a card for every metric.

Use a card when the metric benefits from independent hierarchy or interaction.

## 51.3 Chart relationships

Supporting charts should answer the next natural question raised by the primary chart.

Example:

```text
Revenue trend
    ↓
Which categories caused the change?
    ↓
Which stores contributed?
    ↓
Which individual orders explain the outlier?
```

This creates a coherent analytical flow across a dashboard.

## 51.4 Alignment

Keep:

- chart edges aligned,
- title baselines aligned,
- control placement consistent,
- card padding consistent.

Alignment is part of chart readability.

---

# 52. “Do Not Animate the Wrong Thing” Decision Tree

When planning a motion, ask:

```text
Did the data change?
 ├─ yes → animate the data geometry / metric
 └─ no
     ↓
Did the UI state change?
 ├─ yes → animate the UI state
 └─ no
     ↓
Is there a meaningful interaction feedback need?
 ├─ yes → microinteraction
 └─ no → do not animate
```

Examples:

```text
New sales value      → animate value/bar/line
Filter selected      → animate result state
Tooltip opened       → animate tooltip
Page entered         → subtle structural settle
Decorative card      → usually no animation
Gridline              → usually no animation
Background gradient   → usually no animation
```

---

# 53. Animation Cancellation & Interruption Rules

Real interfaces are interruptible.

Users can:

- change filters before an animation finishes,
- navigate away,
- resize the window,
- trigger a second update,
- switch tabs,
- enable reduced motion.

## 53.1 Never queue stale animations indefinitely

When a new state supersedes an old one:

```text
old animation → cancel / retarget → current state
```

Do not play outdated transitions after the underlying data is already obsolete.

## 53.2 Retarget from the current visual state when possible

If a bar is halfway between old and new values and another refresh arrives, animate from the current visual state to the latest target rather than jumping back.

Motion Values and animation controls can help implement this pattern.

## 53.3 Cleanup

All animations/listeners/subscriptions created by a component should be cleaned up when the component unmounts or the effect is replaced.

---

# 54. Motion & Data Semantics: Do Not Create False Causality

Animation creates a perceived relationship.

Do not imply:

- one category caused another to move unless the data supports that interpretation,
- an item accumulated gradually when it simply appeared as a current total,
- two unrelated metrics transitioned from one another as if they were the same quantity.

A direct interpolation is best when identity is stable.

A crossfade is safer when identity is not stable.

---

# 55. Quality Gate for AI Coding Agents

An AI coding agent should not consider a chart task complete until these checks pass.

## Functional

- correct chart type,
- correct data aggregation,
- correct units,
- correct axes,
- correct totals,
- correct filtering,
- correct sorting,
- correct refresh handling.

## Visual

- hierarchy is clear,
- primary series is identifiable,
- gridlines are subordinate,
- labels do not collide,
- tooltips remain readable,
- mobile remains legible.

## Loading

- independent skeletons,
- no blank analytics modules,
- no skeleton flash for fast responses where a threshold is used,
- no layout jumps,
- partial content can resolve progressively.

## Motion

- initial reveal is coherent,
- updates preserve identity,
- filter/sort/drill transitions communicate the state change,
- no unnecessary bounce,
- no excessive stagger,
- no infinite decorative loops,
- animations cancel correctly,
- reduced motion works.

## Accessibility

- color is not the only cue,
- exact values have a non-hover path,
- keyboard/focus interaction exists where applicable,
- accessible chart summary or equivalent exists,
- focus is visible,
- high contrast works.

## Performance

- no unnecessary full-chart re-render on hover,
- no thousands of heavyweight DOM animations,
- data processing is memoized or moved appropriately,
- resize does not trigger repeated intro animations.

---

# 56. Agent Self-Review Output Format

When an AI coding agent finishes an analytics task, its final implementation summary should use this compact structure:

```text
ANALYTICS IMPLEMENTATION REVIEW

Purpose:
- What analytical question the chart answers.

Chart:
- Chart type and why.

Data:
- Source shape, aggregation, units, missing-data treatment.

States:
- loading / partial / loaded / refreshing / stale / empty / filtered-empty / error.

Motion:
- initial reveal
- update
- enter/exit
- interaction
- cancellation
- reduced-motion behavior

Skeleton:
- independent regions and geometry strategy.

Accessibility:
- summary / exact-value path / keyboard / color / motion.

Responsive:
- desktop / tablet / mobile behavior.

Performance:
- rendering approach and known constraints.

QA:
- tests completed and edge cases checked.
```

Do not claim a check was performed if it was not actually performed.

---

# 57. Recommended Chart Component API Contract

For reusable engineering systems, chart components should have explicit contracts.

Conceptual example:

```ts
type ChartStatus =
  | 'idle'
  | 'loading'
  | 'partial'
  | 'loaded'
  | 'refreshing'
  | 'stale'
  | 'empty'
  | 'filtered-empty'
  | 'error'

type ChartProps<T> = {
  data: T[]
  status: ChartStatus
  title: string
  description?: string
  unit?: string
  locale?: string
  timezone?: string
  reducedMotion?: boolean
  showLegend?: boolean
  showTooltip?: boolean
  showDataTable?: boolean
  selectedSeries?: string[]
  onSeriesSelect?: (seriesId: string) => void
}
```

The exact API should fit the project, but the concepts should remain explicit.

---

# 58. Testing Matrix

Every chart should be tested against more than the happy path.

| Scenario | Expected behavior |
|---|---|
| Zero values | truthful zero, no invented animation semantics |
| One data point | no broken line assumption |
| All values equal | scale remains readable |
| Negative values | baseline and semantics remain correct |
| Huge range | correct scale, no clipping |
| Long labels | layout adapts / wraps / abbreviates intentionally |
| Missing values | gaps or explained missing treatment |
| Outlier | remains visible / explained |
| One series | no unnecessary legend |
| Many series | filtering/highlighting instead of overload |
| Empty | explicit empty state |
| Filtered empty | distinct message + clear filters path |
| Error | local actionable error |
| Slow network | skeleton / progressive resolution |
| Fast network | no obvious placeholder flash |
| Background refresh | old data preserved where valid |
| Rapid filter changes | stale animations cancelled |
| Resize | no intro replay |
| Dark mode | contrast and semantic colors remain valid |
| Reduced motion | no problematic transform motion |
| Keyboard | interaction remains usable |
| Touch | no hover-only dependency |
| Large text | labels/tooltips remain usable |
| High-density data | no catastrophic performance |

---

# 59. Visual Regression & Screenshot QA

For production dashboards, visual testing should include:

- loaded state,
- each loading state,
- empty,
- error,
- dark mode,
- mobile width,
- desktop width,
- reduced motion,
- active tooltip,
- selected series,
- filter changed,
- sorting changed.

Compare for:

- clipping,
- overflow,
- changed chart domains,
- axis shifts,
- label collision,
- layout movement,
- unexpected animation replay.

Do not rely only on a screenshot of the fully loaded happy path.

---

# 60. Research-backed External References

These references are included so a coding/design agent can verify specific implementation decisions against authoritative documentation.

## Apple

Apple Human Interface Guidelines — Charts:
https://developer.apple.com/design/human-interface-guidelines/charts

Useful for:

- chart anatomy,
- axes and grid lines,
- titles and summaries,
- accessible descriptions,
- interactive chart guidance,
- animation as a way to highlight change,
- large hit targets.

Apple explicitly recommends summarizing the chart’s message, keeping data visually prominent, making charts accessible, and using interaction for detail rather than hiding critical information behind interaction.

## IBM Carbon

Color palettes:
https://carbondesignsystem.com/data-visualization/color-palettes/

Legends:
https://carbondesignsystem.com/data-visualization/legends/

Useful for:

- categorical palettes,
- quantitative color systems,
- legend placement,
- data-viz hierarchy.

Carbon’s palette guidance is designed to improve accessibility and neighboring category differentiation.

## Nielsen Norman Group

Skeleton Screens 101:
https://www.nngroup.com/articles/skeleton-screens/

Useful for:

- when skeletons are appropriate,
- perceived wait times,
- progressive loading,
- choosing between skeletons, spinners, and progress indicators.

NN/G notes that skeletons are useful for perceived waits under roughly 10 seconds, while progress indicators become more appropriate for longer waits where duration can be communicated.

## Material UI

Skeleton:
https://mui.com/material-ui/react-skeleton/

Skeleton API:
https://mui.com/material-ui/api/skeleton/

Useful for:

- content-shaped skeletons,
- pulse/wave/no animation options,
- reusable implementation patterns.

MUI’s current Skeleton component supports pulse, wave, or disabled animation, plus geometry-aware variants.

## Microsoft Power BI

Accessibility guidance:
https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-accessibility-creating-reports

Useful for:

- not relying on color alone,
- keyboard navigation,
- alternative text,
- marker/shape alternatives,
- tooltips as secondary rather than primary information,
- keeping the number of visuals focused.

Microsoft specifically recommends supplementing color with markers/text and warns against putting essential information only in tooltips.

## Motion for React / Motion.dev

React docs:
https://motion.dev/docs/react

Animation:
https://motion.dev/docs/react-animation

Motion Values:
https://motion.dev/docs/react-motion-value

Springs:
https://motion.dev/docs/react-use-spring

Reduced motion:
https://motion.dev/docs/react-use-reduced-motion

Layout:
https://motion.dev/docs/react-layout-animations

Animate:
https://motion.dev/docs/animate

Useful for:

- component motion,
- SVG motion,
- counters,
- Motion Values,
- springs,
- reduced motion,
- layout transitions,
- timeline-like sequences.

Current Motion documentation uses the `motion/react` package for React integrations and documents Motion as the modern successor to Framer Motion.

## Anime.js

Documentation:
https://animejs.com/documentation/

Useful for:

- stagger,
- timelines,
- SVG morphing,
- WAAPI workflows,
- explicit timeline positioning.



## GSAP

Timeline:
https://gsap.com/docs/v3/GSAP/Timeline/

DrawSVG:
https://gsap.com/docs/v3/Plugins/DrawSVGPlugin/

MorphSVG:
https://gsap.com/docs/v3/Plugins/MorphSVGPlugin/

Useful for:

- complex sequencing,
- SVG drawing,
- path morphing,
- advanced orchestration.



---

# 61. Final “Master Rule”

Every chart should have a visible answer, a truthful representation, a known loading path, a controlled transition path, an accessible information path, and a predictable behavior when reality changes.

The full mental model is:

```text
QUESTION
  ↓
DATA DEFINITION
  ↓
VISUAL ENCODING
  ↓
CONTEXT
  ↓
LOADING CONTRACT
  ↓
INITIAL REVEAL
  ↓
INTERACTION
  ↓
DATA UPDATE / FILTER / SORT
  ↓
CONTINUITY-PRESERVING TRANSITION
  ↓
ACCESSIBLE ALTERNATIVE
  ↓
RESPONSIVE ADAPTATION
  ↓
ERROR / EMPTY / STALE HANDLING
  ↓
PERFORMANCE + QA
```

The chart should never feel like it “appeared.”

It should feel like the interface was there, the system was working, the information arrived, and the visual explanation resolved naturally.

The best analytical motion is the motion that lets a user follow the data without thinking about the animation itself.

---

# 62. Complete Motion-Library Decision Matrix

Use one motion system by default. Add another only when its capability is clearly required.

| Tool | Best for | Avoid using it for |
|---|---|---|
| CSS transitions / WAAPI | simple state changes, hover, focus, skeletons | complex cross-component orchestration |
| Motion for React | React UI, counters, SVG, layout/state transitions, reduced-motion-aware motion | giant visualization engines when the renderer already provides transitions |
| Framer | visual prototyping and motion exploration | treating a prototype as a substitute for production data/state engineering |
| GSAP | complex timelines, bespoke SVG, scroll-linked choreography, highly controlled sequences | basic button or card transitions |
| Anime.js | explicit timelines, SVG, stagger, custom DOM/SVG choreography | adding a second animation runtime without need |
| React Spring | spring-heavy interactive UIs and data-driven spring physics | simple fade/hover effects that CSS handles easily |
| AutoAnimate | automatic add/remove/reorder movement for ordinary DOM structures | numerical chart geometry or meaning-critical data interpolation |
| Lottie | pre-authored vector/raster animation assets | live analytical chart geometry |
| Rive | interactive state-machine-driven illustrations and product motion | ordinary data charts that should be generated from live data |
| D3 / chart engine | scales, axes, marks, data joins, analytical geometry | generic page transition choreography when another motion layer already exists |

React Spring provides spring-based animation for web/SVG and other render targets. AutoAnimate is designed to animate child add/remove/move operations with minimal setup. Rive is designed around interactive state-machine-driven assets and runtimes. These are complementary tools, not automatic replacements for a chart renderer or a general React motion system.

## 62.1 Default decision

For a standard React analytics dashboard:

```text
CSS/WAAPI
   ↓ if simple transition
Motion for React
   ↓ if React UI orchestration is required
Chart renderer/D3
   ↓ if chart geometry is required
GSAP/Anime.js
   ↓ only if specialized choreography is actually required
Rive/Lottie
   ↓ only for pre-authored illustrative animation, not live chart data
```

## 62.2 One-property-one-owner rule

A given property should have one clear animation owner during a transition.

Bad:

```text
chart library animates y
+ GSAP animates y
+ React state updates y
```

Good:

```text
chart renderer owns data geometry
Motion owns surrounding UI state
one timeline system owns complex choreography
```

This prevents jitter, race conditions, and unpredictable final values.

---

# 63. Chart Microinteraction Library

Use microinteractions as small pieces of analytical feedback.

## 63.1 Hover in

```text
0 ms        pointer enters
0–120 ms    target mark gains emphasis
0–160 ms    tooltip appears
```

Do not delay enough to make the chart feel unresponsive.

## 63.2 Hover out

```text
data emphasis returns to normal
↓
tooltip fades / leaves
```

Avoid long tooltip exit delays that make multiple points stack visually.

## 63.3 Point selection

```text
selected point → marker emphasis + exact detail
other points → remain available but visually secondary
```

## 63.4 Legend selection

```text
click/tap series
↓
selected series emphasizes
others mute
↓
repeat interaction restores normal state
```

## 63.5 Filter application

The control itself should give immediate feedback.

Then the analytical result should transition as one system.

Avoid:

```text
button click
→ full-screen spinner
→ blank chart
→ new chart
```

Prefer:

```text
button selected
→ old valid state remains
→ result geometry changes
→ new state settles
```

## 63.6 Sort control

Sorting should visually preserve each category’s identity.

The most useful beat is often simply:

```text
position A → position B
```

No extra bounce is necessary.

## 63.7 Toggle metric

When toggling between closely related metrics:

- preserve time/category positions where possible,
- change the geometry smoothly,
- update units and labels together,
- do not leave the old unit visible during the new value animation.

## 63.8 Drill-down selection

The selected parent should remain visually related to the child view.

When the visualization becomes a detail table, maintain heading/context continuity so the user knows which item they drilled into.

---

# 64. Data-Transition Safety Rules

Not every data change should be animated.

## 64.1 Animate when identity is stable

Use interpolation when:

```text
same metric
same unit
same categories/entities
same semantic meaning
```

## 64.2 Crossfade or replace when identity changes

Prefer a clearer state transition when:

```text
metric meaning changes
aggregation changes
category universe is replaced
user moves to an unrelated report
scale transform changes radically
```

## 64.3 Avoid animation for impossible physical narratives

Do not animate a product count into a revenue value as if one became the other.

The interface must not create false causal continuity.

## 64.4 Keep controls synchronized

When the data transition changes:

- title,
- subtitle,
- units,
- legend,
- axis labels,
- metric labels,

must resolve in a coordinated way.

A chart that says “Orders” while its axis already represents “Revenue” is a state synchronization bug, not merely a visual bug.

---

# 65. Axis & Label Motion Rules

Axes normally provide stable context.

## 65.1 Keep context stable

Do not make every axis element animate independently on every update.

## 65.2 When the scale changes

Animate the scale as a single conceptual transformation:

```text
old ticks
  ↓
interpolated domain
  ↓
new ticks
```

The marks must move according to the same transformation.

## 65.3 Tick label changes

Do not rapidly swap unrelated tick values with no transition when an animated domain is appropriate.

Avoid making labels blur or visually overlap during the transformation.

## 65.4 Category labels

For sorted bars:

```text
label position → new label position
```

Keep the text attached to the same category identity.

## 65.5 Long labels

Use:

- truncation with a meaningful full-value path,
- wrapping when it does not destroy the chart geometry,
- horizontal bars,
- abbreviated labels with exact tooltip/detail.

Never silently cut a label so far that its category meaning changes.

---

# 66. Charts for Admin / Commerce Dashboards

Operational dashboards have different needs from marketing analytics.

Typical metrics may include:

```text
orders
revenue
average order value
conversion
refunds
inventory
stock-outs
low-stock products
top products
customer acquisition
repeat purchase rate
fulfillment time
returns
```

## 66.1 Operational hierarchy

Use:

```text
What is happening now?
↓
What changed?
↓
Why did it change?
↓
What needs action?
```

## 66.2 KPI cards

Prioritize metrics tied to an operational decision.

Do not fill the first viewport with vanity metrics.

## 66.3 Alert charts

For low-stock, SLA, failure, or warning metrics:

- use semantic status cues,
- show threshold/reference lines,
- label the condition,
- provide direct action where appropriate.

## 66.4 Tables remain essential

For commerce/admin workflows, use a table when the user needs to:

- identify specific records,
- sort by exact value,
- copy information,
- perform operational actions.

A chart should not replace the operational table merely to look modern.

---

# 67. Analytics for Mobile Apps

Mobile analytics need more deliberate simplification.

## 67.1 Prioritize the main answer

At the top of a mobile analytical screen:

```text
primary KPI
↓
comparison
↓
compact trend
↓
detail on demand
```

## 67.2 Touch interaction

Do not make small points individually targetable if the whole plot area can provide the same scrubbing experience.

## 67.3 Gesture conflicts

Chart gestures must not fight page scrolling.

Potential strategies:

- only activate horizontal chart pan after a clear horizontal intent,
- use a dedicated interaction mode,
- prefer tap/scrub over pinch if zoom is not essential.

## 67.4 Mobile tooltips

Do not place large desktop tooltips over tiny chart areas.

Use compact anchored details or a small bottom sheet when necessary.

## 67.5 Orientation changes

Recompute geometry without replaying the initial reveal.

---

# 68. Analytics UX with Gestalt Principles

Use established visual grouping principles to reduce cognitive load.

## Proximity

Items that belong together should be physically closer.

Example:

```text
KPI value
↓
delta
```

should be closer than the KPI is to an unrelated chart.

## Similarity

Use consistent visual language for equivalent metrics and series.

## Common region

A card or panel can establish grouping, but avoid boxing every tiny element.

## Continuity

Transitions should preserve a user’s visual path through the data.

This is one reason position interpolation is useful when sorting.

## Figure-ground

Data must remain distinguishable from the chart surface, grid, and annotations.

Do not allow decorative background effects to compete with marks.

---

# 69. Fitts, Hick & Interaction Cost for Charts

## Fitts’ Law

Important chart interactions should have sufficiently large hit areas.

For small marks:

```text
visual mark can stay small
interaction target can be larger
```

Do not force the pointer to hit a 6 px dot exactly.

## Hick’s Law

Do not expose many equal-priority chart controls at once.

Prefer:

```text
date range
primary filter
optional “More” controls
```

over a row containing 15 equally weighted controls.

## Interaction cost

Every interaction should justify itself.

If the user needs to:

```text
hover
click
open tooltip
click another control
open modal
```

to discover the primary message, the chart is doing too much work.

---

# 70. Motion Accessibility Beyond Reduced Motion

Reduced motion is necessary but not sufficient.

Also consider:

- users with vestibular sensitivity,
- users who zoom the interface,
- users navigating by keyboard or switch access,
- users who consume the chart through a screen reader,
- users on low-powered hardware,
- users in environments where movement is distracting.

## 70.1 Reduced-motion fallback

A valid fallback is not “do nothing and remove all communication.”

Instead replace:

```text
movement
```

with:

```text
state change
+ value update
+ opacity or instantaneous transition
+ explicit text when required
```

## 70.2 Do not hide information when animation is disabled

The final state must still communicate the same information.

## 70.3 Do not tie business logic to animation completion unnecessarily

A user should not be blocked from interacting with the chart merely because an animation has not finished.

---

# 71. Motion Performance Rules by Property

Use this as a practical priority order.

## Low-risk / preferred for UI motion

```text
opacity
transform
```

## Use with intent

```text
color
background-color
clip-path
SVG path properties
```

## Potentially expensive depending on implementation

```text
width
height
top
left
box-shadow
filter / blur
large DOM tree changes
```

For data geometry, correctness takes priority, but the implementation should still avoid unnecessary layout work.

---

# 72. Motion Sequencing Templates

## 72.1 KPI + primary chart

```text
0 ms        title/control stable
80 ms       KPI label/value begins
180 ms      KPI delta begins
180–650 ms  primary chart reveals
450–700 ms  annotations/context settle
```

## 72.2 Three KPI cards

```text
KPI 1 → KPI 2 → KPI 3
```

Use a small stagger only if it improves reading order.

Do not delay later cards so much that the page feels blocked.

## 72.3 Bar ranking

```text
chart shell stable
↓
bars enter from baseline
↓
labels stay fixed
↓
selected/highlight state becomes available
```

## 72.4 Line chart

```text
chart shell stable
↓
path reveal
↓
markers appear if required
↓
interaction layer becomes active
```

## 72.5 Filtered line chart

```text
selected filter
↓
old path remains
↓
new path interpolates
↓
axes/context update if necessary
```

## 72.6 Sorted bar chart

```text
sort action
↓
identity preserved
↓
bars move vertically
↓
lengths update if values changed
↓
new order settles
```

## 72.7 Refreshing KPI + chart

```text
old data visible
↓
refresh indicator
↓
KPI old → new
chart old → new
↓
updated timestamp
```

## 72.8 Error during refresh

```text
old valid state
↓
refresh begins
↓
request fails
↓
old state retained if still valid
+ local error / retry
```

This is usually more useful than destroying the data just because the refresh failed.

---

# 73. Skeleton Recipes by Analytics Component

## KPI skeleton

```text
┌────────────────────┐
│ ━━━━━━━            │  label
│ ███████████        │  value
│ ━━━━━  ─────       │  delta/context
│ ~~~~~~~~~~~~       │  sparkline
└────────────────────┘
```

## Line chart skeleton

```text
title        ━━━━━━━
control      ━━━━

│ · · · · · · ·
│ · · · · · · ·
│ · · · · · · ·
│________________
```

## Bar chart skeleton

```text
Category A  ███████
Category B  █████
Category C  █████████
Category D  ████
```

Skeleton shapes should imply structure without pretending to know the actual values.

## Table skeleton

Use several representative rows, not one large block.

## Donut skeleton

Use the actual donut geometry but avoid adding fake percentages that look like real data.

## Heatmap skeleton

Use the eventual cell grid with subdued placeholder fills.

---

# 74. Loading Strategy by Duration

Use a state appropriate to the expected wait.

```text
very fast
→ render directly, avoid placeholder flash

short perceived wait
→ content-shaped skeleton / subtle placeholder

longer operation with measurable progress
→ progress indicator with meaningful progress information

unknown / blocked
→ explanatory state + retry / next action where appropriate
```

Do not use a skeleton as a fake progress indicator when the system can actually report progress.

NN/G’s skeleton guidance distinguishes skeletons from progress indicators based on the nature and duration of the wait. See the research references in Section 60.

---

# 75. Data Freshness System

Every analytical product should decide how freshness works.

Possible states:

```text
live
just updated
refreshing
stale but usable
stale and blocked
failed to refresh
```

## 75.1 Last updated

Use a timestamp when freshness affects decisions.

Prefer:

```text
Updated 2 min ago
```

over:

```text
Updated recently
```

when exactness matters.

## 75.2 Refresh affordance

Allow manual refresh when the user has a reason to demand current data.

## 75.3 Automatic polling

Do not replay the full initial animation on every polling cycle.

Only animate the changed data.

## 75.4 New data indicator

For a live feed, a new-data marker can be useful:

```text
new value arrives
↓
one-time emphasis
↓
return to normal
```

Do not leave an endlessly pulsing chart point.

---

# 76. Charts Under Error and Degraded Network Conditions

Design for:

- slow API,
- timeout,
- partial API response,
- stale cache,
- malformed data,
- unavailable optional series.

## 76.1 Partial response

Render what is known when safe.

Label unavailable portions rather than creating fake completeness.

## 76.2 Retry

Retry should not automatically replay a dramatic entrance animation if the chart had already been viewed.

## 76.3 Offline/cached analytics

Where cached data is allowed:

```text
cached data visible
↓
offline/stale indicator
↓
refresh when connection returns
```

## 76.4 Malformed value

Do not pass invalid numerical values directly into chart scales.

Validate and sanitize before rendering.

---

# 77. Implementation Checklist for Codex / Claude Code

When asked to build or improve an analytics chart, the agent should internally follow this order:

```text
1. Inspect the existing chart stack.
2. Inspect existing design tokens.
3. Inspect existing animation system.
4. Inspect data fetching and cache behavior.
5. Identify analytical question.
6. Validate data definitions.
7. Select chart type.
8. Define scales and domains.
9. Define color roles.
10. Define skeleton geometry.
11. Define all states.
12. Define interaction behavior.
13. Define motion beats.
14. Define reduced-motion behavior.
15. Implement.
16. Test edge cases.
17. Run visual checks at responsive sizes.
18. Verify data values against source.
19. Verify no animation race conditions.
20. Report what was actually tested.
```

## 77.1 Before adding a dependency

The agent should ask:

```text
Can CSS do this?
Can the existing chart engine do this?
Can the existing Motion system do this?
Does the interaction truly require a specialized library?
```

Only install a new dependency when the answer justifies it.

## 77.2 Preserve project conventions

Do not introduce:

- a new color system,
- a new chart API,
- a second tooltip pattern,
- a second animation runtime,
- different loading behavior,

when the project already has a consistent equivalent.

## 77.3 No speculative refactoring

A chart task should not become an unrelated rewrite of the dashboard unless the existing architecture prevents correct behavior.

---

# 78. Prompt Template: Build a Production Analytics Chart

Use this prompt in Codex, Claude Code, or another coding agent when starting from an implementation request.

```text
Use the Chart & Graph Master Skill for this task.

GOAL
Build/refine: [chart or dashboard]

ANALYTICAL QUESTION
The user needs to understand: [question]

DATA
Source: [source]
Metric: [metric]
Dimensions: [dimensions]
Unit: [unit]
Aggregation: [sum/avg/count/etc]
Time zone: [timezone]
Missing-data rule: [rule]

VISUALIZATION
Chart type: [type or let the skill choose]
Primary comparison: [comparison]
Required context: [target/benchmark/date range/etc]

STATES
Implement:
- idle
- loading
- partial
- loaded
- refreshing
- stale
- empty
- filtered-empty
- error

LOADING
- Give every independently loaded region its own geometry-matched skeleton.
- Avoid skeleton flash for ultra-fast responses when appropriate.
- Preserve layout geometry.
- Preserve valid old data during background refresh.

MOTION
- Follow the flow model from the skill.
- Animate data geometry rather than decorative chart frames.
- Use stable data identity for enter/update/exit.
- Initial KPI may count from 0 only when semantically appropriate.
- Live updates should animate old → new.
- Sorting should move existing categories rather than recreate them.
- Filter changes should preserve continuity when metric identity is unchanged.
- Cancel stale animations when new state supersedes them.
- Respect reduced motion.

COLOR
- Use neutral-first hierarchy.
- Use categorical / sequential / diverging palettes according to data type.
- Never rely on color alone.
- Keep semantic colors stable.

INTERACTION
- Desktop hover.
- Keyboard/focus equivalent.
- Touch equivalent.
- Tooltip only for supplemental detail.
- Exact-value path without hover.

RESPONSIVE
- Desktop.
- Tablet.
- Mobile.
- No intro replay on resize.

ACCESSIBILITY
- Chart summary.
- Exact-value access.
- Keyboard/focus.
- Color-independent meaning.
- Reduced-motion fallback.

PERFORMANCE
- Avoid unnecessary React renders.
- Keep pointer updates local.
- Use appropriate renderer for data density.
- Avoid thousands of independent DOM animations.

VALIDATION
Test:
- zero
- negative
- missing
- empty
- filtered empty
- one point
- one series
- many series
- outlier
- slow network
- fast network
- refresh failure
- resize
- dark mode
- reduced motion
- mobile

Do not invent data.
Do not claim tests you did not run.
Return an implementation review covering purpose, data, states, motion, skeletons, accessibility, responsive behavior, performance, and QA.
```

---

# 79. Review Prompt: Audit an Existing Dashboard

```text
Use the Chart & Graph Master Skill to audit this analytics/dashboard implementation.

Review the entire experience, not only the loaded state.

Audit:
1. Analytical meaning.
2. Chart selection.
3. Data correctness and aggregation.
4. Axis/scales/baselines.
5. Number formatting.
6. Color hierarchy.
7. Accessibility.
8. Loading skeletons.
9. Partial loading.
10. Stale/refresh behavior.
11. Empty/filtered-empty/error states.
12. KPI counter behavior.
13. Initial chart reveal.
14. Update transitions.
15. Enter/update/exit identity.
16. Sort/filter transitions.
17. Tooltip/crosshair behavior.
18. Touch/keyboard behavior.
19. Responsive layout.
20. Motion cancellation.
21. Reduced motion.
22. Rendering performance.
23. Visual consistency across widgets.
24. Dependency/library usage.
25. Data table / alternate representation.

For every issue, classify it as:

P0 = incorrect or misleading data/behavior
P1 = major usability/accessibility/performance problem
P2 = inconsistency or quality issue
P3 = optional polish

Do not rewrite unrelated parts of the product.
Give concrete implementation changes, not vague advice.
```

---

# 80. Golden Rules for the Finished Product

Before shipping, the chart should satisfy all of these:

```text
□ The user knows what the chart answers.
□ The data definition is correct.
□ The units are obvious.
□ The scale is truthful.
□ The primary signal is visually dominant.
□ Gridlines are quiet.
□ Color encodes a real distinction.
□ Color is not the only distinction.
□ Labels are readable.
□ Tooltips add detail rather than hide the answer.
□ Exact values are accessible without hover.
□ Touch works.
□ Keyboard/focus works where applicable.
□ Loading has geometry-matched skeletons.
□ Independent data regions load independently.
□ Fast loads do not visibly flash placeholders.
□ Old valid data is preserved during refresh when appropriate.
□ Empty is distinct from error.
□ Filtered-empty is distinct from global empty.
□ Errors are local and actionable.
□ Initial motion explains arrival.
□ KPI motion has correct semantics.
□ Chart motion preserves data identity.
□ Sort motion preserves identity.
□ Filter motion preserves continuity when semantics stay the same.
□ Unrelated metric changes do not pretend to be continuous data.
□ New live points can be noticed without permanent pulsing.
□ Resize does not replay the intro.
□ Reduced motion preserves information.
□ Animation can be interrupted.
□ Stale animations are cancelled.
□ No unnecessary motion library is added.
□ No two systems fight over the same animated property.
□ Dense datasets remain usable.
□ The mobile version is intentionally designed.
□ Dark mode remains legible.
□ Visual regression covers major states.
□ The agent reports only checks it actually performed.
```

---

# 81. Maintenance Rule

This skill should evolve when the underlying product or platform guidance changes.

When updating it:

- keep the core principles stable,
- replace outdated library APIs,
- verify external documentation links,
- remove deprecated package guidance,
- preserve semantic behavior even when implementation APIs change,
- prefer official documentation for library-specific claims,
- keep examples conceptual enough to remain portable across coding agents.

For library-specific implementation, agents should verify the installed version and current official documentation before copying APIs, because animation and chart libraries evolve independently of this skill.

