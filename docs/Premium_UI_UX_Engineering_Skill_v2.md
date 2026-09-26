# Premium UI/UX Engineering Skill
## Build Interfaces That Feel Designed by a Senior Product Designer

### Purpose

Use this skill whenever you design, implement, review, refactor, or visually polish a product interface.

The goal is not to make the UI "pretty." The goal is to make every screen, especially dashboards and data-heavy screens, precise enough that users can understand what matters and act without unnecessary cognitive effort.

The goal is to make it feel:
- intentional
- calm
- precise
- coherent
- premium
- easy to understand
- fast to use
- appropriate for the product and its users

The interface must not look like generic AI-generated UI.

Do not optimize for Dribbble shots, decorative trends, or "modern" aesthetics by default.

Optimize for:
**hierarchy + usability + consistency + task fit + visual restraint.**

---

# 0. THE MASTER RULE

Before styling anything, answer:

1. What is the user's main task?
2. What is the most important information?
3. What should the eye see first?
4. What should the user do next?
5. Which elements belong together?
6. Which information can be quiet?
7. How much density does this task require?
8. What existing design-system rules already exist?
9. What can be removed?

If a visual element cannot justify its existence, remove it.

The best premium interfaces often feel simple because unnecessary decisions have already been removed.

---

# 1. THE SIX-PART EYE TEST

Every screen must be reviewed through:

1. Hierarchy
2. Spacing
3. Typography
4. Alignment
5. Density
6. Colour

Then add:

7. Components
8. Forms
9. States
10. Interaction
11. Accessibility
12. Motion
13. Platform conventions
14. AI-pattern audit

The question is never merely:

> "Does this look clean?"

Ask:

> "Why does this work?"

Use design language:
- hierarchy
- grouping
- density
- alignment
- optical centre
- contrast
- interaction cost
- consistency
- state visibility

---

# 2. THE FIVE UX LAWS FROM THE REFERENCE

## 2.1 Fitts's Law

### Principle

The time required to acquire a target is affected by its size and distance.

### Practical rule

Important actions should be:
- large enough to hit comfortably
- easy to reach
- visually obvious
- placed where users naturally expect them

For mobile:
- consider thumb reach
- avoid tiny primary controls
- do not place critical actions in difficult-to-reach areas without a good reason
- use adequate touch targets

Do not make a primary action visually beautiful but physically difficult to use.

---

## 2.2 Hick's Law

### Principle

More choices generally increase decision time.

### Practical rule

Do not present every possible action at once.

Prefer:
- one clear primary action
- a small number of secondary actions
- progressive disclosure for advanced options
- sensible grouping
- defaults

Do not turn every feature into a button.

If the user has 12 things they can do, ask whether all 12 need to be visible immediately.

---

## 2.3 Jakob's Law

### Principle

Users expect a product to work similarly to products they already know.

### Practical rule

Do not reinvent familiar interaction patterns without a strong reason.

Users already understand conventions for:
- navigation
- search
- back
- tabs
- settings
- forms
- filters
- carts
- profiles
- messaging
- media controls
- pull-to-refresh
- menus
- modal dialogs

Innovation should happen where it improves the product, not merely to look different.

---

## 2.4 Law of Proximity

### Principle

Things placed close together are perceived as related.

### Practical rule

Use spacing to communicate structure.

Related:
- title + subtitle
- label + field
- value + unit
- icon + label
- image + caption

should generally be closer together.

Separate:
- sections
- unrelated actions
- different concepts

with larger spacing.

Spacing is information architecture.

---

## 2.5 Von Restorff Effect

### Principle

A visually different element is more likely to attract attention.

### Practical rule

Use visual distinction selectively.

Good:
- one primary CTA
- one selected tab
- one current step
- one critical warning

Bad:
- every button highlighted
- every card coloured
- multiple competing accent colours
- every status made visually loud

If everything stands out, nothing stands out.

---

# 3. OTHER HIGH-VALUE UX LAWS AND PRINCIPLES

Use these as design tools, not as excuses to force a theory onto every screen.

## 3.1 Aesthetic-Usability Effect

Users often perceive aesthetically pleasing interfaces as easier to use.

Practical implication:

Visual polish matters, but it must sit on top of good usability.

Do not use visual polish to hide bad UX.

---

## 3.2 Tesler's Law

Every system has unavoidable complexity.

### Rule

Do not simply move complexity from the product onto the user.

The product should absorb complexity wherever reasonable.

Good:
- sensible defaults
- automatic formatting
- smart suggestions
- remembered choices
- progressive disclosure

Bad:
- forcing users to understand internal system rules
- exposing technical complexity unnecessarily
- making users manually configure things the system can infer safely

---

## 3.3 Doherty Threshold

Systems feel more productive when interaction feedback is fast.

### Rule

Keep interactions responsive.

When work cannot complete immediately:
- show progress
- provide immediate feedback
- use skeleton/loading states where appropriate
- avoid dead taps
- avoid unexplained delays

Never make the interface feel frozen.

---

## 3.4 Miller's Law — Use Carefully

People have limited working memory.

Do not turn the popular "7±2" idea into a rigid UI rule.

Instead:

Reduce unnecessary cognitive load.

Use:
- chunking
- grouping
- progressive disclosure
- recognition instead of recall
- sensible defaults

Do not expect users to remember information from one screen while using it on another.

---

## 3.5 Serial Position Effect

Users tend to remember items at the beginning and end of a sequence better.

### Practical use

Important actions can benefit from predictable placement.

Do not bury important actions randomly in long lists.

---

## 3.6 Peak-End Rule

People often remember an experience based heavily on its most intense point and its ending.

### Practical use

Pay special attention to:
- onboarding completion
- successful checkout
- task completion
- confirmations
- errors
- final result screens

A good completion state should feel clear and reassuring.

---

# 4. GESTALT PRINCIPLES

Use perception principles to make the interface easier to understand.

## Proximity

Already covered:
close = related.

## Similarity

Similar things should look similar.

Examples:
- same type of action → same button style
- same type of data → same typography
- same state → same colour semantics

## Common Region

Elements inside the same meaningful region can be perceived as a group.

Use containers only when the grouping actually matters.

Do not put everything into cards.

## Figure-Ground

The user should be able to distinguish:
- content
- controls
- background
- overlays
- disabled elements

Do not create low-contrast interfaces where important controls disappear into the background.

## Continuity

Layouts should guide the eye naturally.

Use:
- consistent alignment
- predictable columns
- repeated structures
- clear reading direction

## Closure

The brain can complete incomplete forms.

Do not rely on this excessively.

Important information should still be explicit.

## Common Fate

Elements that move together can be perceived as related.

Use coordinated motion when elements belong to the same interaction.

---

# 5. NIELSEN-STYLE USABILITY PRINCIPLES

Apply these as a review checklist.

## Visibility of system status

The interface should tell users what is happening.

Examples:
- loading
- saving
- syncing
- processing
- success
- failure
- offline

Never leave the user wondering whether a tap worked.

---

## Match the real world

Use language and concepts users understand.

Avoid unnecessary technical terminology.

---

## User control and freedom

Users should be able to:
- go back
- cancel
- undo where appropriate
- close temporary UI
- recover from mistakes

Do not trap users in flows.

---

## Consistency

The same thing should look and behave the same way.

---

## Error prevention

Prevent mistakes where possible.

Examples:
- sensible defaults
- constrained inputs
- confirmation for destructive actions
- disabled impossible actions
- clear validation

---

## Recognition over recall

Show what users need instead of making them remember it.

Good:
- visible labels
- recent choices
- selected filters
- contextual help

---

## Flexibility and efficiency

Support both:
- new users
- frequent users

Use shortcuts or faster paths where they genuinely help.

---

## Minimalist design

Every element should earn its place.

Minimalism does not mean empty screens.

It means removing irrelevant information.

---

## Error recovery

Errors should tell users:
1. what happened
2. what caused it when useful
3. what they can do next

Avoid:
`Something went wrong.`

Prefer:
`We couldn't save your meal. Check your connection and try again.`

---

## Help and documentation

Good UI should not require a manual for normal use.

Use education only where necessary.

---

# 6. INFORMATION HIERARCHY

Every screen should have:

### Primary
The thing that matters most.

### Secondary
Information needed to understand the primary content.

### Tertiary
Useful but quiet information.

### Action
The next meaningful user action.

A screen with five "primary" elements has no hierarchy.

Hierarchy can be created with:
- position
- size
- weight
- contrast
- colour
- spacing
- grouping

Do not solve every hierarchy problem with bigger text.

---

# 7. SPACING SYSTEM

Use a coherent spacing system.

Recommended starting scale:

```text
4
8
12
16
20
24
32
40
48
64
80
```

Do not use every value everywhere.

Typical interpretation:

```text
4px   = extremely tight relationship
8px   = close relationship
12px  = compact internal spacing
16px  = standard spacing
20px  = comfortable separation
24px  = group separation
32px  = major section separation
40px+ = large structural spacing
```

The numbers are not sacred.

Consistency is.

---

# 8. ALIGNMENT

Misalignment is one of the fastest ways to make an interface feel amateur.

Check:
- left edges
- right edges
- baselines
- icon centres
- button contents
- card boundaries
- section headings
- navigation items

Then check optical alignment.

Mathematical centering is not always visual centering.

---

# 9. TYPOGRAPHY SYSTEM

Typography should create hierarchy, not visual noise.

## Default font

For a general cross-platform product:

**Inter**

Recommended weights:
- 400 Regular
- 500 Medium
- 600 Semibold
- 700 Bold only when necessary

Alternative families when the product calls for them:
- Geist — modern product/SaaS
- SF Pro — Apple-native experience
- IBM Plex Sans — technical/data-heavy
- Manrope — softer consumer products

Do not mix fonts simply to appear premium.

One excellent type family with a disciplined hierarchy is usually better.

## Type rules

Use a limited number of sizes.

A typical system:

```text
Display
H1
H2
H3
Body
Secondary
Caption
```

Do not create 14 slightly different text sizes.

Do not make every text element bold.

Do not make every piece of metadata high contrast.

---

# 10. COLOUR SYSTEM

Colour is information, not decoration.

Prefer:
- neutral base
- one main brand/action colour
- semantic colours

Semantic:
- success
- warning
- error
- information

Do not use a different colour for every component.

### Colour questions

Before adding colour:

1. What does this colour mean?
2. Is it necessary?
3. Does it compete with the primary action?
4. Does it match the existing semantic system?
5. Would the interface work without it?

If colour adds no information, remove it.

---

# 11. THE ANTI-AI VISUAL RULES

These are hard defaults unless the product's established visual identity explicitly requires otherwise.

## No forced gradients

Do not automatically use:
- purple-blue gradients
- blue-purple CTA gradients
- gradient cards
- gradient text
- glowing gradient borders
- gradient backgrounds

A gradient must have a real brand or functional reason.

Default:

**No gradient.**

---

## No generic sparkle icons

Do not use:
- ✨
- stars
- sparkle badges
- "AI magic" symbols

merely to indicate AI.

AI should be communicated through:
- product behaviour
- clear labels
- meaningful icons
- useful interaction

not decoration.

---

## No card-everything design

Not every section needs a rounded card.

Use:
- whitespace
- dividers
- alignment
- typography
- grouping

before containers.

---

## No excessive rounded corners

Do not make everything:
- 24px rounded
- pill-shaped
- floating
- bubble-like

Use a coherent radius scale.

Starting point:

```text
4–6px   compact controls
8px     standard controls
10–12px surfaces/cards
pill    only when the component is actually a pill
```

---

## No decorative blobs

Avoid:
- random circles
- blobs
- floating shapes
- abstract waves
- glowing orbs
- stars

unless they are part of the actual brand.

---

## No excessive glassmorphism

Avoid automatically adding:
- backdrop blur
- translucent cards
- frosted panels
- glowing borders

Use glass only when it has a clear visual purpose.

---

## No excessive shadows

Elevation should mean something.

Use shadows primarily for:
- modal
- popover
- floating surface
- meaningful elevation

Do not make every card float.

---

## No random iconography

Use one coherent icon family.

Do not mix:
- outlined icons
- filled icons
- 3D icons
- colourful icons
- random SVG styles

on one interface without a deliberate system.

---

# 12. PREMIUM DOES NOT MEAN MORE DECORATION

A premium interface usually comes from precision.

Premium feel comes from:
- consistent spacing
- careful typography
- restrained colour
- strong alignment
- quality microcopy
- predictable interaction
- excellent states
- correct density
- subtle motion
- good imagery
- consistent components

Not from:
- gradients
- glow
- excessive blur
- huge typography everywhere
- massive rounded cards
- random animations
- decorative icons

Think:

**less noise + more precision.**

---

# 13. COMPONENT SYSTEM

The quality of the interface lives in the relationships between components.

Define systems before individual components.

## Buttons

Define:
- height
- radius
- typography
- padding
- icon spacing
- primary
- secondary
- tertiary
- destructive
- disabled
- loading

Do not randomly create:
- 40px here
- 44px there
- 48px elsewhere

unless there is a documented reason.

---

## Inputs

Use:
- persistent labels
- clear focus
- clear error states
- helper text when needed
- sensible grouping

Do not rely only on placeholders as labels.

---

## Cards

A card should represent a meaningful boundary.

Define:
- padding
- radius
- border/elevation
- title hierarchy
- metadata
- actions

Do not create a unique card style for every section.

---

## Navigation

Use platform conventions where possible.

Navigation should answer:
- where am I?
- where can I go?
- what is selected?
- how do I go back?

Do not make navigation clever at the cost of recognition.

---

# 14. FORMS

Use:

```text
Group
  Label
  Field
  Helper/Error
```

Related fields belong together.

Use more space between groups than inside groups.

Always make clear:
- what the field means
- whether it is required
- what went wrong
- how to fix it

Good-looking forms that are difficult to understand are not good UI.

---

# 15. STATES

Every important screen must consider:

- loading
- empty
- populated
- error
- success
- disabled
- partial data
- offline where relevant
- permission denied
- first-time state
- returning-user state

For step-based flows:

```text
Completed → quiet
Current   → loudest
Future    → subdued
```

The current state should be obvious.

---

# 16. DENSITY

Density must match the job.

High-density UI may be correct for:
- admin
- analytics
- trading
- operations
- professional workflows

Lower-density UI may be correct for:
- onboarding
- focused consumer actions
- meditation
- storytelling
- high-emotion moments

Do not add whitespace simply because whitespace looks premium.

Do not cram content simply because the product is information-heavy.

---

# 17. HICK + FITTS TOGETHER

These two laws are especially useful for action design.

### Hick:
Reduce unnecessary choices.

### Fitts:
Make important choices easy to hit.

Therefore:

**Reduce the number of important actions, then make the remaining important action easy to find and use.**

This is often more effective than adding visual emphasis.

---

# 18. PROGRESSIVE DISCLOSURE

Do not expose all complexity immediately.

Show:
1. what the user needs now
2. relevant context
3. advanced options when needed

Examples:
- advanced filters behind "More filters"
- secondary settings inside a settings section
- detailed analytics behind a drill-down
- destructive actions behind an overflow menu when appropriate

But do not hide frequently needed actions just to make the screen look clean.

---

# 19. DEFAULTS

Good defaults reduce effort.

Use defaults when:
- the choice is common
- the default is safe
- users can easily change it

Never use a default that can cause meaningful harm or an unwanted irreversible action.

---

# 20. FEEDBACK

Every meaningful interaction should have an appropriate response.

Examples:
- button press → immediate visual response
- save → confirmation
- loading → progress indication
- invalid input → clear error
- selection → selected state
- destructive action → appropriate confirmation
- background sync → unobtrusive status

Avoid dead interactions.

---

# 21. TOUCH AND TARGETS

For mobile interfaces:

- make primary actions easy to hit
- avoid tiny controls
- provide adequate separation between adjacent actions
- do not place destructive and primary actions so close that accidental taps are likely
- consider thumb reach
- preserve comfortable touch areas even if the visible icon is small

The visible icon size and the interactive hit area do not have to be identical.

---

# 22. MOBILE ERGONOMICS

Do not design mobile screens as miniature desktop screens.

Consider:
- thumb zones
- one-handed use
- bottom navigation
- bottom sheets
- reachable primary actions
- keyboard obstruction
- safe areas
- dynamic content height
- scrolling behaviour

Primary actions should generally be reachable without awkward hand movement.

---

# 23. PLATFORM CONVENTIONS

Jakob's Law means users bring expectations from other products.

Respect established conventions for:
- navigation
- back
- gestures
- search
- tab bars
- menus
- dialogs
- permissions
- system feedback
- keyboard behaviour

Break a convention only when the benefit is clear and the new behaviour can be understood.

---

# 24. CONTENT AND MICROCOPY

Good UI needs good words.

Avoid:
- "Submit"
- "Continue"
- "Click here"
- vague error messages
- unnecessary marketing language

Prefer:
- "Create account"
- "Review order"
- "Save meal"
- "View property"
- "Try again"

Buttons should describe the result of the action.

Errors should explain recovery.

Labels should describe the content, not the implementation.

---

# 25. MOTION

Motion should explain change.

Good uses:
- navigation
- state transitions
- expansion
- collapse
- confirmation
- loading
- hierarchy

Avoid:
- endless floating animations
- decorative movement
- excessive spring physics
- long transitions
- animations on every element

Motion should be:
- short
- purposeful
- interruptible where appropriate
- consistent

Do not animate just because the framework makes it easy.

---

# 26. IMAGERY AND VISUAL ASSETS

Use imagery intentionally.

Do not add:
- stock images merely to fill space
- random illustrations
- generic 3D objects
- abstract blobs
- AI-generated decoration

Images should support:
- comprehension
- emotion
- product identity
- content
- orientation

If an image has no job, remove it.

---

# 27. EMPTY SPACE

Whitespace is not automatically premium.

Ask:

> What does this empty space accomplish?

Good whitespace:
- separates concepts
- improves scanability
- establishes hierarchy
- creates focus

Bad whitespace:
- makes users scroll unnecessarily
- pushes useful information below the fold
- creates huge gaps without structural purpose

---

# 28. RESPONSIVE DESIGN

Do not simply shrink desktop.

At each breakpoint decide:
- what remains
- what collapses
- what becomes secondary
- what moves
- what becomes scrollable
- what changes density

Preserve:
- hierarchy
- task flow
- readability
- reachability

---

# 29. ACCESSIBILITY

Premium UI is accessible UI.

Check:
- colour contrast
- readable text
- touch targets
- focus states
- keyboard navigation where applicable
- screen-reader labels
- semantic structure
- reduced-motion preferences
- error identification
- non-colour status indicators

Do not communicate important information through colour alone.

---

# 30. AI-GENERATED UI RED FLAGS

Actively search for:

- purple/blue gradients everywhere
- sparkle icons
- excessive glassmorphism
- glowing borders
- huge rounded cards
- everything inside a card
- oversized headings with little useful content
- excessive whitespace
- random colourful badges
- colourful icon grids
- floating blobs
- excessive shadows
- multiple competing CTAs
- too many font sizes
- too many font weights
- inconsistent radii
- inconsistent button heights
- random spacing
- decorative icons
- identical dashboard tiles
- excessive pills
- generic AI wording
- excessive animation
- unnecessary complexity
- Dribbble-style layouts that make real tasks harder

If several appear together:

**Stop polishing. Revisit the hierarchy and design system.**

---

# 31. THE "ONE THING WINS" RULE

On most screens, one thing should clearly win.

It might be:
- a primary action
- a key metric
- a product image
- a current state
- a search field
- a result

Everything else supports it.

If:
- CTA
- banner
- search
- navigation
- card
- badge
- illustration

are all equally loud, the hierarchy is broken.

---

# 32. THE "DISTANCE COMMUNICATES RELATIONSHIP" RULE

Use spacing as a semantic tool.

Example:

```text
Title
Subtitle
[small gap]

Section
[medium gap]

Next Section
[large gap]
```

Do not use equal spacing everywhere.

Equal spacing does not automatically mean clean.

It can destroy grouping.

---

# 33. THE "CURRENT STATE IS LOUD" RULE

Whenever a process has states:

```text
Completed = quiet
Current   = strongest
Future    = subdued
```

The user should immediately know where they are.

This applies to:
- onboarding
- checkout
- uploads
- progress
- setup
- verification
- multi-step forms

---

# 34. THE "RECOGNITION OVER RECALL" RULE

Whenever possible, show the information users need instead of requiring them to remember it.

Prefer:
- visible labels
- recent items
- selected filters
- examples
- contextual information
- inline guidance

Avoid:
- hidden meanings
- unexplained icons
- placeholder-only fields
- cryptic abbreviations
- interactions that require memorization

---

# 35. THE "SYSTEM OVER INDIVIDUAL" RULE

When implementing a new UI element:

Before creating it, check:

1. Does an existing component already solve this?
2. Can an existing spacing value work?
3. Can an existing type level work?
4. Can an existing colour work?
5. Can an existing radius work?
6. Can an existing icon work?

Only introduce a new token or component when there is a real reason.

---

# 36. DESIGN TOKENS

Whenever possible, define:

```text
colors
spacing
typography
radii
shadows
borders
motion
breakpoints
icon sizes
component heights
```

Example conceptual system:

```text
Spacing: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64

Radius: 4 / 8 / 12 / full

Button heights: small / medium / large

Type: display / heading / body / secondary / caption

Elevation: none / low / medium / high
```

Do not allow arbitrary values to spread through the codebase.

---

# 37. CODING AGENT IMPLEMENTATION RULES

When implementing UI:

1. Inspect the existing design system first.
2. Reuse components before creating new ones.
3. Establish hierarchy before decoration.
4. Use the existing token system.
5. Keep spacing systematic.
6. Keep typography systematic.
7. Keep iconography consistent.
8. Keep buttons consistent.
9. Keep radii consistent.
10. Keep colours semantic.
11. Do not add gradients by default.
12. Do not use sparkle icons as generic AI indicators.
13. Do not add decorative blobs.
14. Do not add glassmorphism without a reason.
15. Do not make every element a card.
16. Do not make every control a pill.
17. Do not add random shadows.
18. Do not introduce random colours.
19. Do not rely on placeholder-only forms.
20. Design every meaningful state.
21. Design for real content, not only placeholder content.
22. Check mobile ergonomics.
23. Check responsive behaviour.
24. Check accessibility.
25. Check loading/empty/error/success states.
26. Review interaction feedback.
27. Review motion.
28. Run the Eye Test.
29. Run the AI-pattern audit.
30. Fix system-level problems before polishing individual elements.

---

# 38. WHEN USING AI TO GENERATE UI

Never give an agent only:

> "Make it modern, premium, and beautiful."

Instead give actual decisions.

Example:

```text
Build a mobile dashboard for users who check their progress daily.

Primary:
- today's progress

Secondary:
- weekly progress
- recent activity

Design system:
- Inter
- neutral background
- one accent colour
- 8px-based spacing logic
- restrained borders
- 12px standard surface radius
- consistent button heights
- moderate density
- one primary CTA

UX principles:
- Fitts's Law for primary actions
- Hick's Law to reduce unnecessary choices
- Jakob's Law for familiar navigation
- Proximity for grouping
- Von Restorff Effect for selective emphasis

Avoid:
- gradients
- sparkle icons
- glassmorphism
- decorative blobs
- excessive shadows
- excessive pills
- random coloured cards
- unnecessary animation
- decorative icons
```

Give the agent design decisions, not adjectives.

---

# 39. DESIGN REVIEW PROCESS

## Pass 1 — Task

What is the user trying to accomplish?

## Pass 2 — Structure

Ignore colour and decoration.

Check:
- hierarchy
- grouping
- density
- task flow

## Pass 3 — Laws

Check:
- Fitts
- Hick
- Jakob
- Proximity
- Von Restorff
- relevant Gestalt principles

## Pass 4 — Alignment

Check:
- edges
- baselines
- icons
- padding
- margins

## Pass 5 — Typography

Check:
- family
- size
- weight
- line height
- contrast

## Pass 6 — Colour

Check:
- semantic meaning
- action colour
- contrast
- unnecessary colour

## Pass 7 — Components

Check:
- buttons
- inputs
- cards
- navigation
- icons
- radii
- states

## Pass 8 — Interaction

Check:
- feedback
- reachability
- touch targets
- loading
- errors
- transitions

## Pass 9 — AI Audit

Search for:
- gradients
- sparkle icons
- excessive cards
- glass
- blobs
- pills
- random colour
- random shadows
- decorative UI

## Pass 10 — Real Task

Ask:

> Would a real user complete the task quickly and confidently?

---

# 40. THE 20-SECOND CRIME SCENE TEST

Take a random screen.

Give yourself approximately 20 seconds.

Identify:

1. What is this screen for?
2. What is the primary thing?
3. What should I do next?
4. What belongs together?
5. What feels wrong?
6. What is too loud?
7. What is too quiet?
8. What is unnecessary?

Name the actual issue.

Do not say:

> "It looks bad."

Say:

> "The secondary action has the same visual weight as the primary action."

Or:

> "The title and metadata are too close and read as one hierarchy level."

Or:

> "The spacing between form fields is identical to the spacing between groups, so the grouping is unclear."

Or:

> "The selected state is not visually distinct enough from the default state."

---

# 41. PRETTY VS BETTER

Never optimize for the screenshot alone.

A beautiful UI can still be bad UX.

A slightly denser UI can be better if it:
- reduces scrolling
- improves scanning
- exposes useful information
- makes actions clearer
- reduces cognitive load

Judge the interface against its job.

---

# 42. FINAL SHIPPING CHECKLIST

### UX Laws
- [ ] Primary targets are easy to reach
- [ ] Choices are not unnecessarily numerous
- [ ] Familiar conventions are respected
- [ ] Proximity communicates relationships
- [ ] Visual emphasis is selective

### Hierarchy
- [ ] One clear primary focus
- [ ] Primary action is obvious
- [ ] Secondary content is quieter
- [ ] Nothing decorative competes with the task

### Spacing
- [ ] Related items are close
- [ ] Unrelated groups are separated
- [ ] Spacing follows a system
- [ ] No random gaps

### Typography
- [ ] One primary font family
- [ ] Limited type sizes
- [ ] Limited weights
- [ ] Clear hierarchy
- [ ] Metadata is appropriately quiet

### Alignment
- [ ] Major edges line up
- [ ] Icons are optically aligned
- [ ] Buttons align
- [ ] Baselines are consistent

### Density
- [ ] Density matches the task
- [ ] Useful information is not hidden by excessive whitespace
- [ ] Screen is not unnecessarily crowded

### Colour
- [ ] Colour communicates meaning
- [ ] Accent is restrained
- [ ] Semantic colours are consistent
- [ ] No unnecessary rainbow

### Components
- [ ] Buttons form a system
- [ ] Inputs form a system
- [ ] Cards form a system
- [ ] Icons form a system
- [ ] Radii form a system

### States
- [ ] Loading
- [ ] Empty
- [ ] Error
- [ ] Success
- [ ] Disabled
- [ ] Current state
- [ ] Offline where relevant

### Accessibility
- [ ] Contrast checked
- [ ] Touch targets are adequate
- [ ] Focus states exist
- [ ] Important information is not colour-only
- [ ] Motion can be reduced where appropriate

### Anti-AI
- [ ] No forced gradients
- [ ] No generic sparkle icons
- [ ] No decorative blobs
- [ ] No excessive glass
- [ ] No excessive pills
- [ ] No card-everything layout
- [ ] No random shadows
- [ ] No random colours
- [ ] No decorative icons without purpose
- [ ] No unnecessary animation
- [ ] No generic "AI magic" visual language

---

# 43. THE STANDARD

Do not aim for:

> "This looks AI-generated."

Do not even aim for:

> "This looks beautiful."

Aim for:

> "This feels obvious."

The strongest interfaces make users feel like the product already knows how they expect things to work.

The visual quality should come from:

**Hierarchy  
Spacing  
Typography  
Alignment  
Density  
Colour  
Consistency  
Interaction  
States  
Accessibility  
Task fit**

not from decoration.

The final question is:

> Can the team explain why each important design decision exists?

If yes, the interface is being designed.

If the answer is only:

> "Because it looks cool."

Remove it.


---

# 43. DASHBOARD DESIGN RULES

For dashboards, analytics screens, admin panels, reporting interfaces, and data-heavy home screens, apply these rules in addition to the general UI/UX system.

The dashboard must help the user understand what matters and decide what to do next.

## 43.1 Prioritize Key Metrics

Put the most important numbers where users can find and understand them quickly.

Prioritize:
- primary KPIs
- important changes
- urgent exceptions
- current status
- metrics directly tied to the user's goal

Do not give every metric equal visual weight.

A useful KPI structure is:

```text
Metric name
Primary value
Change / comparison
Relevant time period
Optional context
```

Example:

```text
Monthly Revenue
₹2.48L
↑ 12% vs last month
```

Do not add a mini-chart to every KPI card simply because there is room for one.

## 43.2 Group Related Data

Related information should live together.

Use:
- sections
- whitespace
- shared headings
- cards when a boundary is genuinely useful
- tabs when datasets are genuinely distinct
- tables for structured comparison

The user should be able to predict where information belongs.

## 43.3 Use Consistent Cards

When cards are appropriate, establish one card system.

Keep consistent:
- padding
- radius
- border/elevation
- title placement
- value hierarchy
- metadata position
- action placement
- icon treatment
- internal spacing

Do not create a different visual language for every KPI.

Consistency means shared structural rules, not identical content.

## 43.4 Avoid Chart Overload

Every chart must answer a question.

Ask:

> What decision does this chart help the user make?

If there is no good answer, remove it.

Avoid:
- decorative charts
- duplicate charts
- too many series
- excessive colours
- unreadable legends
- tiny labels
- charts with no meaningful comparison
- charts added merely to make a dashboard look sophisticated

Prefer the simplest visualization that communicates the insight.

## 43.5 Choose the Chart for the Question

**Line chart:** trends and change over time.

**Bar chart:** category comparison and ranking.

**Stacked visualization:** composition when both total and parts matter.

**Table:** exact values, many attributes, scanning, or row-level actions.

**KPI:** one number is the main answer.

**Progress indicator:** progress toward a known goal.

Never choose a chart because it looks impressive.

## 43.6 Show Trends Over Time

When change matters, show the trend.

Where relevant, include:
- comparison period
- direction
- magnitude
- time range

Example:

```text
+12% vs last month
```

Always make the comparison period clear. Do not imply a trend from too little data.

## 43.7 Use Filters and Search Wisely

Filtering and search should reduce cognitive and visual load.

Use filters when users commonly need meaningful subsets.

Use search when users know what they are looking for and searching is faster than scanning.

Good filters have:
- clear labels
- sensible defaults
- visible selected state
- easy reset
- understandable combinations
- predictable results

Avoid:
- ten filters visible by default
- unclear icon-only filters
- hidden active filters
- technical terminology users do not understand

Use progressive disclosure for advanced filters.

## 43.8 Keep Actions Obvious

A dashboard should not only report information. It should make the next useful action clear.

Examples:
- Review overdue invoices
- Create report
- Approve request
- View details
- Resolve issue
- Export data

Use one primary action per meaningful context.

Do not make users guess what clicking a card will do.

## 43.9 Dashboard Scan Order

A useful default pattern is:

```text
Context / page title
        ↓
Primary action
        ↓
Key metrics
        ↓
Important trends / exceptions
        ↓
Detailed data
        ↓
Secondary actions
```

This is not rigid. An operational dashboard may need urgent exceptions near the top. An analytics dashboard may give more space to trends.

Hierarchy follows the user's job.

## 43.10 Exceptions Can Be Louder Than Normal Data

Do not make every status loud.

Genuine attention items should be distinguishable:
- overdue
- failed
- blocked
- expiring
- out of stock
- action required

Use semantic colour and clear copy. Do not rely on red alone.

## 43.11 KPI Cards Need Context

Avoid:

```text
$42,840
```

Prefer:

```text
Revenue
$42,840
↑ 12% vs last month
```

The user should understand:
- what the number represents
- whether it changed
- compared with what
- over what period

Do not show unexplained percentages or arrows.

## 43.12 Tables Are First-Class UI

Do not force structured data into cards when a table is better.

Tables are often better for:
- transactions
- users
- orders
- properties
- inventory
- logs
- records
- comparisons

Good tables support:
- clear column hierarchy
- readable row density
- aligned numeric values
- sorting
- filtering
- pagination/virtualization when needed
- row actions
- loading states
- empty states

Do not turn every desktop row into a giant mobile-style card.

## 43.13 Density Must Match the User

Ask:

> Is the user scanning, comparing, monitoring, deciding, or creating?

Scanning and monitoring often benefit from compact density.

First-time learning may benefit from more breathing room.

Do not blindly apply huge cards and oversized whitespace to professional dashboards.

## 43.14 Dashboard Empty States

An empty dashboard should explain:
- why it is empty
- what the user can do
- what will appear afterward

Example:

```text
No reports yet

Create your first report to start tracking performance.

[Create report]
```

Do not fill an empty dashboard with meaningless placeholder charts.

## 43.15 Dashboard Loading States

Prefer:
- skeletons when the final content shape is predictable
- immediate page structure
- progress indicators for longer operations

Avoid:
- blank screens
- giant spinners
- jumping layouts
- skeletons that bear little resemblance to the final content

## 43.16 Responsive Dashboard Behaviour

On smaller screens, do not simply stack every desktop card vertically.

Decide:
- which metrics remain visible
- which become secondary
- which charts simplify
- which tables scroll or transform appropriately
- which filters collapse
- which actions remain reachable

Preserve the most important information first.

---

# 44. DATA VISUALIZATION QUALITY

Data visualization is UX, not decoration.

## 44.1 Reduce Non-Data Ink

Do not visually compete with the data using:
- heavy borders
- decorative backgrounds
- unnecessary gridlines
- redundant labels
- excessive legends

Give visual priority to the data.

## 44.2 Use Colour Semantically

Do not assign random colours to every series.

Use restrained colour for:
- category distinction
- status
- selection
- emphasis

Important distinctions should not depend on colour alone.

## 44.3 Use Honest Scales

Do not manipulate axes to make small changes look dramatic.

Make units, intervals, time ranges, and baselines understandable.

## 44.4 Label Important Information Directly

Do not force users to decode a legend when direct labels would be clearer.

## 44.5 Tooltips Are Secondary

The main insight should not depend entirely on hover. Touch devices need another way to access detail.

---

# 45. SEARCH, FILTER, SORT

These controls should answer:

> How can I get to the information I need faster?

Search = known-item retrieval.

Filter = narrow a dataset.

Sort = change ordering.

Do not combine all three without making their roles obvious.

When filters are active:
- show the active state
- make clearing easy
- preserve selections where appropriate
- explain result changes when necessary

---

# 46. DASHBOARD ACTION HIERARCHY

Use:

```text
Primary action
Secondary action
Tertiary action
Row-level action
Destructive action
```

Do not give every action the same visual treatment.

Example:

```text
[Create Report]       ← primary

[Export] [Filter]     ← secondary

⋯                     ← contextual

Delete                ← destructive
```

The action system should visually explain priority.

---

# 47. PREMIUM DASHBOARD STANDARD

A premium dashboard should feel like a well-organized instrument, not a collection of decorative widgets.

The user should be able to answer quickly:

1. Where am I?
2. What matters?
3. What changed?
4. What needs attention?
5. What can I do next?
6. Where can I find more detail?

If it cannot answer these questions, fix the information architecture before changing colours, shadows, or gradients.

---

# 48. SCREEN-SPECIFIC RULES

Do not use one visual recipe for every screen.

**Dashboard:** metrics, trends, exceptions, actions.

**Detail page:** identity, key facts, primary action, supporting information.

**Form:** task completion, grouping, labels, validation, progress.

**List:** scanning, filtering, sorting, row actions.

**Search:** query, results, filters, empty state.

**Settings:** grouping, discoverability, consistency, safe destructive actions.

**Onboarding:** one decision at a time, context, progress, low cognitive load.

**Analytics:** comparisons, trends, exact values, filters, density.

Do not force a dashboard design onto every screen.

---

# 49. PROFESSIONALITY CHECK

Before calling a screen premium, inspect:

### Visual precision
- Are edges aligned?
- Are component dimensions consistent?
- Are radii consistent?
- Are icons optically aligned?
- Are text baselines consistent?

### Information precision
- Is primary information obvious?
- Is every metric contextualized?
- Are labels unambiguous?
- Are states explicit?

### Interaction precision
- Are targets easy to hit?
- Is feedback immediate?
- Are actions predictable?
- Can users recover from errors?

### System precision
- Does this screen use existing tokens?
- Does it reuse existing components?
- Does it behave like the rest of the product?
- Are new patterns justified?

### Visual restraint
- Can anything be removed?
- Are gradients actually necessary?
- Are shadows actually necessary?
- Are cards actually necessary?
- Are icons actually necessary?
- Is animation actually necessary?

---

# 50. FINAL AGENT INSTRUCTION

When asked to "make it premium", "make it modern", "make it beautiful", or "make it professional", do not interpret that as permission to add decoration.

Interpret it as:

```text
Increase precision.
Improve hierarchy.
Improve spacing.
Improve typography.
Improve alignment.
Improve component consistency.
Improve information architecture.
Improve interaction feedback.
Improve accessibility.
Match platform conventions.
Reduce visual noise.
Remove unnecessary elements.
Use colour deliberately.
Use motion sparingly.
Make the primary task obvious.
```

The desired result is not:

> AI-generated premium UI.

It is:

> A coherent product designed by someone who knows exactly why every element is there.
