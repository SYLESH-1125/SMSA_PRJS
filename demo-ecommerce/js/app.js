// ===== ShopLite demo app logic =====
// Plain vanilla JS: state -> render. Cart persists in localStorage.
(function () {
  "use strict";

  const CART_KEY = "shoplite-cart-v1";

  // ---------- State ----------
  const state = {
    search: "",
    category: "All",
    sort: "featured",
    cart: loadCart() // { [productId]: qty }
  };

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  const grid = $("product-grid");
  const chipsWrap = $("category-chips");
  const searchInput = $("search-input");
  const sortSelect = $("sort-select");
  const resultsInfo = $("results-info");
  const emptyState = $("empty-state");
  const cartDrawer = $("cart-drawer");
  const overlay = $("overlay");
  const cartItemsEl = $("cart-items");
  const cartCountEl = $("cart-count");
  const cartSubtotalEl = $("cart-subtotal");
  const checkoutBtn = $("checkout-btn");
  const clearCartBtn = $("clear-cart-btn");
  const checkoutModal = $("checkout-modal");
  const checkoutForm = $("checkout-form");
  const orderSummary = $("order-summary");
  const orderSuccess = $("order-success");
  const toastEl = $("toast");

  // ---------- Persistence ----------
  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      // keep only ids that still exist in the catalog
      const clean = {};
      for (const [id, qty] of Object.entries(parsed)) {
        if (PRODUCTS.some((p) => p.id === id) && Number.isInteger(qty) && qty > 0) clean[id] = qty;
      }
      return clean;
    } catch {
      return {};
    }
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  }

  // ---------- Helpers ----------
  const money = (n) => "$" + n.toFixed(2);

  function cartEntries() {
    return Object.entries(state.cart)
      .map(([id, qty]) => ({ product: PRODUCTS.find((p) => p.id === id), qty }))
      .filter((e) => e.product);
  }

  function cartCount() {
    return Object.values(state.cart).reduce((a, b) => a + b, 0);
  }

  function cartSubtotal() {
    return cartEntries().reduce((sum, e) => sum + e.product.price * e.qty, 0);
  }

  function stars(rating) {
    const full = Math.round(rating);
    return "★".repeat(full) + "☆".repeat(5 - full) + " " + rating.toFixed(1);
  }

  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
  }

  // ---------- Filtering / sorting ----------
  function visibleProducts() {
    const q = state.search.trim().toLowerCase();
    let list = PRODUCTS.filter((p) => {
      const matchesCat = state.category === "All" || p.category === state.category;
      const matchesQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.desc.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });

    switch (state.sort) {
      case "price-asc":  list.sort((a, b) => a.price - b.price); break;
      case "price-desc": list.sort((a, b) => b.price - a.price); break;
      case "name-asc":   list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "rating-desc":list.sort((a, b) => b.rating - a.rating); break;
      default: break; // featured = catalog order
    }
    return list;
  }

  // ---------- Renderers ----------
  function renderChips() {
    const cats = ["All", ...new Set(PRODUCTS.map((p) => p.category))];
    chipsWrap.innerHTML = "";
    cats.forEach((cat) => {
      const b = document.createElement("button");
      b.className = "chip" + (state.category === cat ? " active" : "");
      b.textContent = cat;
      b.setAttribute("role", "tab");
      b.addEventListener("click", () => {
        state.category = cat;
        renderChips();
        renderGrid();
      });
      chipsWrap.appendChild(b);
    });
  }

  function renderGrid() {
    const list = visibleProducts();
    grid.innerHTML = "";
    emptyState.classList.toggle("hidden", list.length > 0);
    resultsInfo.textContent = `${list.length} product${list.length === 1 ? "" : "s"}` +
      (state.category !== "All" ? ` in ${state.category}` : "") +
      (state.search.trim() ? ` matching “${state.search.trim()}”` : "");

    list.forEach((p) => {
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <div class="card-img" aria-hidden="true">${p.emoji}</div>
        <div class="card-body">
          <div class="card-title"></div>
          <div class="card-desc"></div>
          <div class="card-meta">
            <span class="price">${money(p.price)}</span>
            <span class="rating" title="Rating ${p.rating} of 5">${stars(p.rating)}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn primary block" data-add="${p.id}">Add to cart</button>
        </div>`;
      card.querySelector(".card-title").textContent = p.name;
      card.querySelector(".card-desc").textContent = p.desc;
      card.querySelector("[data-add]").addEventListener("click", () => addToCart(p.id));
      grid.appendChild(card);
    });
  }

  function renderCart() {
    const entries = cartEntries();
    const count = cartCount();
    cartCountEl.textContent = String(count);
    cartSubtotalEl.textContent = money(cartSubtotal());
    checkoutBtn.disabled = count === 0;
    clearCartBtn.disabled = count === 0;

    cartItemsEl.innerHTML = "";
    if (entries.length === 0) {
      cartItemsEl.innerHTML = '<p class="cart-empty">Your cart is empty.<br>Add something nice! 🛍️</p>';
      return;
    }

    entries.forEach(({ product: p, qty }) => {
      const row = document.createElement("div");
      row.className = "cart-item";
      row.innerHTML = `
        <div class="cart-item-emoji" aria-hidden="true">${p.emoji}</div>
        <div class="cart-item-info">
          <div class="cart-item-name"></div>
          <div class="cart-item-price">${money(p.price)} × ${qty} = <strong>${money(p.price * qty)}</strong></div>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" data-dec aria-label="Decrease quantity">−</button>
          <span class="qty-val">${qty}</span>
          <button class="qty-btn" data-inc aria-label="Increase quantity">+</button>
        </div>
        <button class="remove-btn" data-remove aria-label="Remove ${p.name}">🗑</button>`;
      row.querySelector(".cart-item-name").textContent = p.name;
      row.querySelector("[data-dec]").addEventListener("click", () => changeQty(p.id, -1));
      row.querySelector("[data-inc]").addEventListener("click", () => changeQty(p.id, +1));
      row.querySelector("[data-remove]").addEventListener("click", () => removeFromCart(p.id));
      cartItemsEl.appendChild(row);
    });
  }

  // ---------- Cart actions ----------
  function addToCart(id) {
    state.cart[id] = (state.cart[id] || 0) + 1;
    saveCart();
    renderCart();
    const p = PRODUCTS.find((x) => x.id === id);
    toast(`Added “${p.name}” to cart`);
  }

  function changeQty(id, delta) {
    const next = (state.cart[id] || 0) + delta;
    if (next <= 0) delete state.cart[id];
    else state.cart[id] = next;
    saveCart();
    renderCart();
  }

  function removeFromCart(id) {
    delete state.cart[id];
    saveCart();
    renderCart();
  }

  function clearCart() {
    state.cart = {};
    saveCart();
    renderCart();
  }

  // ---------- Drawer ----------
  function openCart() {
    cartDrawer.classList.add("open");
    cartDrawer.setAttribute("aria-hidden", "false");
    overlay.classList.remove("hidden");
  }

  function closeCart() {
    cartDrawer.classList.remove("open");
    cartDrawer.setAttribute("aria-hidden", "true");
    overlay.classList.add("hidden");
  }

  // ---------- Checkout ----------
  function openCheckout() {
    if (cartCount() === 0) return;
    closeCart();
    // build order summary
    const rows = cartEntries()
      .map(({ product: p, qty }) =>
        `<div class="row"><span>${qty} × ${escapeHtml(p.name)}</span><span>${money(p.price * qty)}</span></div>`)
      .join("");
    orderSummary.innerHTML = rows +
      `<div class="row total"><span>Total</span><span>${money(cartSubtotal())}</span></div>`;
    checkoutForm.classList.remove("hidden");
    orderSuccess.classList.add("hidden");
    checkoutModal.classList.remove("hidden");
    $("co-name").focus();
  }

  function closeCheckout() {
    checkoutModal.classList.add("hidden");
    checkoutForm.reset();
    checkoutForm.querySelectorAll("input").forEach((i) => i.classList.remove("invalid"));
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  checkoutForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fields = [$("co-name"), $("co-email"), $("co-address")];
    let ok = true;
    fields.forEach((f) => {
      const valid = f.checkValidity() && f.value.trim() !== "";
      f.classList.toggle("invalid", !valid);
      if (!valid) ok = false;
    });
    if (!ok) return;

    const orderId = "SL-" + Date.now().toString(36).toUpperCase();
    const total = money(cartSubtotal());
    const name = $("co-name").value.trim();
    $("order-confirm-msg").textContent =
      `Thanks, ${name}! Order ${orderId} for ${total} is confirmed. (Demo only — nothing was charged.)`;

    clearCart();
    checkoutForm.classList.add("hidden");
    orderSuccess.classList.remove("hidden");
  });

  // ---------- Wire up ----------
  searchInput.addEventListener("input", () => {
    state.search = searchInput.value;
    renderGrid();
  });

  sortSelect.addEventListener("change", () => {
    state.sort = sortSelect.value;
    renderGrid();
  });

  $("brand-link").addEventListener("click", (e) => {
    e.preventDefault();
    state.search = "";
    state.category = "All";
    searchInput.value = "";
    renderChips();
    renderGrid();
  });

  $("cart-toggle").addEventListener("click", openCart);
  $("cart-close").addEventListener("click", closeCart);
  overlay.addEventListener("click", closeCart);
  clearCartBtn.addEventListener("click", () => { clearCart(); toast("Cart cleared"); });
  checkoutBtn.addEventListener("click", openCheckout);
  $("checkout-cancel").addEventListener("click", closeCheckout);
  $("continue-shopping").addEventListener("click", closeCheckout);
  checkoutModal.addEventListener("click", (e) => {
    if (e.target === checkoutModal) closeCheckout();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeCart(); closeCheckout(); }
  });

  // ---------- Init ----------
  renderChips();
  renderGrid();
  renderCart();
})();
