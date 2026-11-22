---
name: Louagi Design Identity
colors:
  surface: '#fbf8fc'
  surface-dim: '#dbd9dc'
  surface-bright: '#fbf8fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f6'
  surface-container: '#efedf0'
  surface-container-high: '#e9e7eb'
  surface-container-highest: '#e4e2e5'
  on-surface: '#1b1b1e'
  on-surface-variant: '#44474e'
  inverse-surface: '#303033'
  inverse-on-surface: '#f2f0f3'
  outline: '#75777e'
  outline-variant: '#c5c6cf'
  surface-tint: '#4e5e80'
  primary: '#031634'
  on-primary: '#ffffff'
  primary-container: '#1a2b4a'
  on-primary-container: '#8293b7'
  inverse-primary: '#b6c6ee'
  secondary: '#835500'
  on-secondary: '#ffffff'
  secondary-container: '#feae2c'
  on-secondary-container: '#6b4500'
  tertiary: '#14171a'
  on-tertiary: '#ffffff'
  tertiary-container: '#282c2e'
  on-tertiary-container: '#909396'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#b6c6ee'
  on-primary-fixed: '#081b39'
  on-primary-fixed-variant: '#364767'
  secondary-fixed: '#ffddb4'
  secondary-fixed-dim: '#ffb955'
  on-secondary-fixed: '#291800'
  on-secondary-fixed-variant: '#633f00'
  tertiary-fixed: '#e0e3e6'
  tertiary-fixed-dim: '#c4c7ca'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#44474a'
  background: '#fbf8fc'
  on-background: '#1b1b1e'
  surface-variant: '#e4e2e5'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 20px
  gutter: 16px
---

## Brand & Style

The brand personality for this design system is built on the intersection of modern financial reliability and North African hospitality. It communicates efficiency for the daily traveler and absolute trust for the long-distance passenger. The aesthetic is a blend of **Modern Fintech**—characterized by precision, high-contrast typography, and functional clarity—and a **Warm Regional Personality** expressed through soft geometry and sun-drenched accents.

The UI avoids the cold, clinical nature of global tech by utilizing rounded shapes and tactile card elements that feel approachable. It aims to evoke a sense of "premium utility," making the complex logistics of Tunisian inter-city travel feel effortless and secure.

## Colors

The palette is anchored by **Deep Navy**, representing the stability and institutional trust required for a transportation platform. This is contrasted by **Amber Gold**, an accent color that draws inspiration from the Mediterranean sun and local craftsmanship, used strategically for primary actions and highlights.

The background uses a cool **Light Gray** to maintain a clean, spacious feel, ensuring that the primary navy elements and colorful status indicators remain highly legible. Success and Error states follow standard semantic conventions but are adjusted for high visibility against the neutral background.

## Typography

This design system utilizes **Plus Jakarta Sans** to achieve a modern, geometric, and friendly tone. The rounded terminals of this typeface align perfectly with the "Warm North African" personality while maintaining the professional rigor of a fintech platform.

Headings are set in Bold weights with slight negative letter-spacing to create a strong visual impact and hierarchy. Body text prioritizes legibility with a Medium or Regular weight and generous line-height to ensure comfort during long reading sessions on mobile devices.

## Layout & Spacing

The design system employs a **fluid grid** logic based on an 8px base unit (with 4px increments for tighter components). On mobile devices, a 4-column grid is used with 20px outside margins to frame the content safely. For desktop views, a 12-column grid is implemented.

Information density is kept moderate. Vertical rhythm is established through consistent padding within cards and sections, ensuring that the UI feels organized but never cramped. Large gutters are used between primary navigation elements to prevent accidental taps.

## Elevation & Depth

Depth is communicated through **ambient shadows** and **tonal layering**. Surfaces do not use harsh black shadows; instead, they utilize ultra-diffused, low-opacity shadows tinted with the Primary Deep Navy color (e.g., `rgba(26, 43, 74, 0.08)`).

- **Level 0 (Floor):** The Light Gray background.
- **Level 1 (Cards):** White surfaces with a soft 4px blur shadow.
- **Level 2 (Active/Floating):** White surfaces with an 12px blur shadow, used for active selections or bottom sheets.

This approach creates a "stacked paper" effect that feels tactile and organized without the clutter of heavy borders.

## Shapes

The shape language is defined by **Rounded** geometry. Standard components like cards and input fields use a 0.5rem (8px) radius to soften the interface. Larger containers and decorative elements use 1rem (16px) or 1.5rem (24px) to emphasize the friendly, "local" nature of the brand.

Special elements, specifically status indicators and action buttons, utilize **pill-shaped** (fully rounded) geometry to distinguish them as interactive or informative badges.

## Components

### Ride Cards
Primary containers for booking options. These feature a white background, soft shadow, and a prominent **driver avatar** in a circular frame. The price is always displayed in Bold Deep Navy in the top right.

### Stat Cards
Used for trip history or driver ratings. These are distinguished by a **4px solid left border** in Amber Gold to draw the eye and signify importance. They use a slightly more compact layout than ride cards.

### Buttons & Inputs
- **Primary Button:** Pill-shaped, Deep Navy background with White text.
- **Secondary Button:** Pill-shaped, Amber Gold background for high-conversion actions.
- **Input Fields:** Light Gray fill with no border, transitioning to a Deep Navy 1px border on focus.

### Status Badges
Pill-shaped badges using Success Green or Error Red with 10% opacity fills and 100% opacity text for high legibility and a modern fintech look.

### Icons
Minimal, filled icons with rounded corners. Icons should always be rendered in the Deep Navy color or Amber Gold to maintain brand consistency.