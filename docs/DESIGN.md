# DESIGN.md

Reference: docs/mockup.html. Match its structure and layout. Colors are placeholder and not final — see "Not yet settled" below.

## Typography
- Display/headings: Fraunces (serif)
- Body and UI: Inter

## Layout
- Sticky header: brand left, nav + cart button right, cart button shows item count badge
- Hero: eyebrow label, large serif headline, one short paragraph, one CTA
- Menu: grid of item cards (name, short description, price, Add to cart), one item may be visually larger/featured
- Cart: slide-out drawer from the right, not a separate page. Scrim behind it, Escape and scrim-click close it.
- Checkout: separate page, order summary + sign-in/submit, reached from the cart drawer's Checkout button

## Interaction
- Opening the cart: slide in from right with a dimming scrim, reduced-motion disables the slide (snap open/closed instead)
- Quantity steppers in the cart use plain + / − buttons
- Hover state on menu cards: subtle background shift, no heavy shadows or scale transforms

## Accessibility
- All icon-only buttons (cart, close, quantity steppers) have aria-labels
- Visible focus outline on every interactive element
- Contrast must pass 4.5:1 for body text regardless of final palette
- Respect prefers-reduced-motion

## Not yet settled (ask before finalizing)
- Final color palette — current placeholder is NOT approved as final, do not treat it as the design direction
- Whether the hero includes a real photo/image or stays illustration-free
