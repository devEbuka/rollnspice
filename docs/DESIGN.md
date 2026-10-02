# DESIGN.md

Approved reference: [street-food UI mockup](approved-ui-mockup.png), approved by the user on 2026-10-02. This supersedes the original provisional palette and serif direction in docs/mockup.html. The original mockup remains the reference for exact menu content.

## Visual direction
- Bold independent Lagos street-food brand: warm cream, charcoal, orange, food photography, and a small lime accent.
- Anton condensed display headings and Inter body text, loaded with next/font.
- Cream background #fff3de, charcoal #211e1a, cream panels #fff8eb, muted text #665a4b. Orange #c93910 is darkened from the image concept for accessible text and buttons; bright orange remains in photography/decorations. Lime #d2e344 appears in the fresh sticker.
- Generated food photographs in public/images are illustrative brand assets, not photographs supplied by the shop. The hero is a transparent cutout; menu photos are decorative because item names/descriptions supply their meaning.

## Layout
- Sticky wordmark/header with desktop navigation and native disclosure navigation on small screens. Cart sits beside account controls and shows only its icon on small screens, with item count retained in its accessible label. Auth state, cart count, and Orders link use existing behavior.
- Two-column desktop hero: oversized BIG FLAVOUR. NO SHORTCUTS. heading, short copy/CTA, food photograph and lime sticker. Mobile stacks copy, food, then CTA.
- Static charcoal brand strip: Flame grilled / Hand rolled / Lagos loved. No moving marquee.
- Rounded menu cards with photographs, exact database names/descriptions/prices, and orange plus buttons with Add to cart labels. Featured treatment is driven solely by the featured column.
- Four-column large-screen menu grid; featured item spans two. Three/two columns on smaller screens; single-column mobile.
- Right-side modal cart drawer retains quantities, removal, subtotal, checkout, keyboard focus containment and focus restoration.
- Auth, checkout and order history use the same fonts, palette, rounded panels/buttons and spacing; their existing security/data behavior is unchanged.

## Accessibility and interaction
- Body text contrast at least 4.5:1; control boundaries and focus must remain visible.
- Icon-only controls have accessible labels; photographs do not repeat card text for screen readers.
- Skip links, cart live announcements, checkout submission/error/result focus and internal auth return paths remain intact.
- Subtle hover background changes; no card scaling. Respect prefers-reduced-motion and forced-colors focus.

## Assets and changes
- Hero and six menu product types have repository-local imagery; Original Beef Roll uses the original hero photograph as its menu image. Asset mapping affects presentation only, never prices or featured status.
- No promotions, ratings, delivery promises, payment options or business claims were added beyond the approved mockup copy.
