// Presentation assets only; all product content and prices come from Supabase.
const images = {
  "The Original Beef Roll": "/images/hero.png",
  "Chicken Shawarma": "/images/chicken.png",
  "Suya Shawarma": "/images/suya.png",
  "Falafel Wrap": "/images/falafel.png",
  "Spiced Fries": "/images/fries.png",
  "Zobo": "/images/zobo.png",
};

export function productImage(name) { return images[name] || null; }
