// ===== ShopLite demo product catalog =====
// Emoji stand in for product photos so the demo needs zero image assets.
const PRODUCTS = [
  { id: "p01", name: "Wireless Headphones", emoji: "🎧", price: 79.99,  rating: 4.6, category: "Electronics", desc: "Over-ear Bluetooth headphones with 30h battery and ANC." },
  { id: "p02", name: "Smart Watch",         emoji: "⌚", price: 129.00, rating: 4.4, category: "Electronics", desc: "Fitness tracking, heart-rate monitor, 7-day battery." },
  { id: "p03", name: "Mechanical Keyboard", emoji: "⌨️", price: 89.50,  rating: 4.8, category: "Electronics", desc: "Hot-swappable switches, RGB backlight, USB-C." },
  { id: "p04", name: "4K Action Camera",    emoji: "📷", price: 199.99, rating: 4.3, category: "Electronics", desc: "Waterproof to 10m, image stabilization, Wi-Fi transfer." },
  { id: "p05", name: "Portable Speaker",    emoji: "🔊", price: 45.00,  rating: 4.2, category: "Electronics", desc: "Pocket-size Bluetooth speaker with punchy bass." },
  { id: "p06", name: "Classic Denim Jacket",emoji: "🧥", price: 64.99,  rating: 4.5, category: "Fashion",     desc: "Timeless mid-wash denim with a relaxed fit." },
  { id: "p07", name: "Running Sneakers",    emoji: "👟", price: 74.95,  rating: 4.7, category: "Fashion",     desc: "Lightweight knit upper with responsive foam sole." },
  { id: "p08", name: "Leather Backpack",    emoji: "🎒", price: 98.00,  rating: 4.6, category: "Fashion",     desc: "Full-grain leather, padded 15\" laptop sleeve." },
  { id: "p09", name: "Aviator Sunglasses",  emoji: "🕶️", price: 39.99,  rating: 4.1, category: "Fashion",     desc: "Polarized UV400 lenses in a classic metal frame." },
  { id: "p10", name: "Espresso Machine",    emoji: "☕", price: 249.00, rating: 4.8, category: "Home",        desc: "15-bar pump, steam wand, cafe-quality shots at home." },
  { id: "p11", name: "Cast Iron Skillet",   emoji: "🍳", price: 34.50,  rating: 4.9, category: "Home",        desc: "Pre-seasoned 12\" skillet — stove, oven or campfire." },
  { id: "p12", name: "Aroma Diffuser",      emoji: "🕯️", price: 27.99,  rating: 4.0, category: "Home",        desc: "Ultrasonic diffuser with 7-color ambient light." },
  { id: "p13", name: "Indoor Plant Set",    emoji: "🪴", price: 42.00,  rating: 4.5, category: "Home",        desc: "Three easy-care plants in ceramic pots." },
  { id: "p14", name: "Yoga Mat Pro",        emoji: "🧘", price: 48.00,  rating: 4.6, category: "Sports",      desc: "6mm non-slip mat with alignment guides and strap." },
  { id: "p15", name: "Adjustable Dumbbells",emoji: "🏋️", price: 159.00, rating: 4.7, category: "Sports",      desc: "5–25 kg per hand with quick-dial weight change." },
  { id: "p16", name: "Trail Mountain Bike", emoji: "🚲", price: 549.00, rating: 4.4, category: "Sports",      desc: "Hardtail 29er, hydraulic disc brakes, 1x11 drivetrain." },
  { id: "p17", name: "Tennis Racket",       emoji: "🎾", price: 119.00, rating: 4.3, category: "Sports",      desc: "Graphite frame tuned for control and spin." },
  { id: "p18", name: "Sci-Fi Novel Bundle", emoji: "📚", price: 29.99,  rating: 4.8, category: "Books",       desc: "Three award-winning space-opera paperbacks." },
  { id: "p19", name: "Cookbook: One Pot",   emoji: "📖", price: 21.50,  rating: 4.5, category: "Books",       desc: "80 weeknight recipes, one pot, minimal cleanup." },
  { id: "p20", name: "Kids Puzzle 1000pc",  emoji: "🧩", price: 18.99,  rating: 4.2, category: "Books",       desc: "1000-piece world-map jigsaw for ages 8+." }
];
