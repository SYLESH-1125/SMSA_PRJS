# ShopLite — Demo E-Commerce App

A simple, dependency-free demo storefront built with plain **HTML + CSS + JavaScript**.
No backend, no build step, no real payments.

## Features
- 🛍️ 20-product catalog (emoji imagery — zero assets needed)
- 🔎 Live search across name / description / category
- 🏷️ Category filter chips + 5 sort modes (price, name, rating)
- 🛒 Slide-out cart drawer: add, +/- quantity, remove, clear
- 💾 Cart persists in `localStorage` across page reloads
- ✅ Checkout modal with form validation and mock order confirmation
- 📱 Responsive layout, keyboard (Esc) and ARIA-friendly

## Run it
No install needed. Either:

1. **Double-click** `index.html`, or
2. Serve it (nicer URLs, no file:// quirks):
   ```
   cd demo-ecommerce
   python -m http.server 8080
   # open http://localhost:8080
   ```

## Structure
```
demo-ecommerce/
├── index.html        # page markup: header, grid, cart drawer, checkout modal
├── css/
│   └── styles.css    # dark-theme styling, responsive grid, drawer/modal
└── js/
    ├── products.js   # product catalog (PRODUCTS array)
    └── app.js        # state, filtering/sorting, cart, checkout logic
```

> Demo only: the "Place order" step simulates confirmation — nothing is charged
> and no data leaves the browser.
