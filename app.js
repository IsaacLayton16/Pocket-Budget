const STORAGE_KEY = "pocket-budget-v1";

const defaultState = {
  totalBudget: 0,
  categories: [
    { id: makeId(), name: "Groceries", budget: 0 },
    { id: makeId(), name: "Food", budget: 0 },
    { id: makeId(), name: "Gas", budget: 0 },
    { id: makeId(), name: "Shopping", budget: 0 },
    { id: makeId(), name: "Bills", budget: 0 },
    { id: makeId(), name: "Fun", budget: 0 },
  ],
  purchases: [],
  sortMode: "newest",
  activePage: "purchases",
};

let state = loadState();

const els = {
  spentTotal: document.querySelector("#spentTotal"),
  remainingTotal: document.querySelector("#remainingTotal"),
  daysRemaining: document.querySelector("#daysRemaining"),
  totalProgress: document.querySelector("#totalProgress"),
  budgetStatus: document.querySelector("#budgetStatus"),
  resetData: document.querySelector("#resetData"),
  totalBudget: document.querySelector("#totalBudget"),
  saveBudget: document.querySelector("#saveBudget"),
  addCategory: document.querySelector("#addCategory"),
  categoryBudgets: document.querySelector("#categoryBudgets"),
  categorySummary: document.querySelector("#categorySummary"),
  purchaseForm: document.querySelector("#purchaseForm"),
  purchaseName: document.querySelector("#purchaseName"),
  purchaseCategory: document.querySelector("#purchaseCategory"),
  purchasePrice: document.querySelector("#purchasePrice"),
  purchaseDate: document.querySelector("#purchaseDate"),
  purchaseList: document.querySelector("#purchaseList"),
  emptyState: document.querySelector("#emptyState"),
  purchaseCount: document.querySelector("#purchaseCount"),
  sortMode: document.querySelector("#sortMode"),
  tabPurchases: document.querySelector("#tabPurchases"),
  tabHealth: document.querySelector("#tabHealth"),
  purchasePage: document.querySelector("#purchasePage"),
  healthPage: document.querySelector("#healthPage"),
  categoryRowTemplate: document.querySelector("#categoryRowTemplate"),
};

els.purchaseDate.valueAsDate = new Date();
render();

els.saveBudget.addEventListener("click", () => {
  state.totalBudget = parseMoney(els.totalBudget.value);
  saveAndRender();
});

els.addCategory.addEventListener("click", () => {
  state.categories.push({ id: makeId(), name: "New category", budget: 0 });
  saveAndRender();
  requestAnimationFrame(() => {
    const inputs = els.categoryBudgets.querySelectorAll(".category-name");
    inputs[inputs.length - 1]?.select();
  });
});

els.purchaseForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = els.purchaseName.value.trim();
  const price = parseMoney(els.purchasePrice.value);
  const categoryId = els.purchaseCategory.value;
  const date = els.purchaseDate.value;

  if (!name || !categoryId || price <= 0 || !date) return;

  state.purchases.push({
    id: makeId(),
    name,
    categoryId,
    price,
    date,
    createdAt: new Date().toISOString(),
  });

  els.purchaseForm.reset();
  els.purchaseDate.valueAsDate = new Date();
  saveAndRender();
});

els.sortMode.addEventListener("change", () => {
  state.sortMode = els.sortMode.value;
  saveAndRender();
});

els.tabPurchases.addEventListener("click", () => {
  state.activePage = "purchases";
  saveAndRender();
});

els.tabHealth.addEventListener("click", () => {
  state.activePage = "health";
  saveAndRender();
});

els.resetData.addEventListener("click", () => {
  const ok = window.confirm("Reset all budgets and purchases on this phone?");
  if (!ok) return;
  state = cloneDefaultState();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Budget data could not be cleared in this browser.", error);
  }
  els.purchaseDate.valueAsDate = new Date();
  render();
});

function render() {
  normalizeState();
  syncTotalBudgetFromCategories();
  els.totalBudget.value = state.totalBudget || "";
  els.sortMode.value = state.sortMode;
  renderTabs();
  renderBudgetHeader();
  renderCategoryBudgetRows();
  renderPurchaseCategoryOptions();
  renderCategorySummary();
  renderPurchases();
}

function renderBudgetHeader() {
  const totalSpent = getTotalSpent();
  const totalBudget = state.totalBudget;
  const remaining = totalBudget - totalSpent;
  const hasBudget = totalBudget > 0;
  const percent = hasBudget ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const over = hasBudget && remaining < 0;
  const daysRemaining = getDaysRemainingInCycle();

  els.spentTotal.textContent = formatMoney(totalSpent);
  els.remainingTotal.textContent = hasBudget ? formatMoney(remaining) : "$0.00";
  els.remainingTotal.className = `mt-1 text-lg font-black ${over ? "text-[#ffb1a8]" : "text-white"}`;
  els.daysRemaining.textContent = `${daysRemaining}/14`;
  els.totalProgress.style.width = `${percent}%`;
  els.totalProgress.style.background = over ? "#ff8a7a" : "#50d890";
  els.budgetStatus.textContent = hasBudget
    ? over
      ? `${formatMoney(Math.abs(remaining))} over your total budget.`
      : `${formatMoney(remaining)} left in your total budget.`
    : "Set a budget to start tracking.";
}

function renderCategoryBudgetRows() {
  els.categoryBudgets.replaceChildren();

  state.categories.forEach((category) => {
    const row = els.categoryRowTemplate.content.cloneNode(true);
    const wrapper = row.querySelector("div");
    const nameInput = row.querySelector(".category-name");
    const budgetInput = row.querySelector(".category-budget");
    const removeButton = row.querySelector(".category-remove");

    nameInput.value = category.name;
    budgetInput.value = category.budget || "";
    removeButton.disabled = state.categories.length === 1;
    removeButton.classList.toggle("opacity-40", removeButton.disabled);

    nameInput.addEventListener("input", () => {
      category.name = nameInput.value;
      saveAndRenderQuietly();
    });

    budgetInput.addEventListener("input", () => {
      category.budget = parseMoney(budgetInput.value);
      syncTotalBudgetFromCategories();
      saveAndRenderQuietly();
    });

    removeButton.addEventListener("click", () => {
      const fallback = state.categories.find((item) => item.id !== category.id);
      state.purchases = state.purchases.map((purchase) =>
        purchase.categoryId === category.id ? { ...purchase, categoryId: fallback.id } : purchase
      );
      state.categories = state.categories.filter((item) => item.id !== category.id);
      syncTotalBudgetFromCategories();
      saveAndRender();
    });

    wrapper.dataset.categoryId = category.id;
    els.categoryBudgets.append(row);
  });
}

function renderTabs() {
  const showingHealth = state.activePage === "health";

  els.purchasePage.hidden = showingHealth;
  els.healthPage.hidden = !showingHealth;
  els.tabPurchases.classList.toggle("is-active", !showingHealth);
  els.tabHealth.classList.toggle("is-active", showingHealth);
}

function renderPurchaseCategoryOptions() {
  const selected = els.purchaseCategory.value;
  els.purchaseCategory.replaceChildren();

  state.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name || "Untitled";
    els.purchaseCategory.append(option);
  });

  if (state.categories.some((category) => category.id === selected)) {
    els.purchaseCategory.value = selected;
  }
}

function renderCategorySummary() {
  const totals = getCategoryTotals();
  els.categorySummary.replaceChildren();

  state.categories.forEach((category) => {
    const spent = totals.get(category.id) || 0;
    const budget = category.budget || 0;
    const percent = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
    const over = budget > 0 && spent > budget;

    const card = document.createElement("article");
    card.className = `card p-3 ${over ? "status-bad" : "status-good"}`;
    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <h3 class="truncate text-sm font-black">${escapeHtml(category.name || "Untitled")}</h3>
          <p class="mt-1 text-xs font-semibold opacity-80">${formatMoney(spent)}${budget > 0 ? ` / ${formatMoney(budget)}` : ""}</p>
        </div>
        <p class="shrink-0 text-xs font-black">${budget > 0 ? (over ? "Over" : "Good") : "No cap"}</p>
      </div>
      <div class="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
        <div class="h-full rounded-full ${over ? "bg-[#e85d4f]" : "bg-[#0f8b8d]"}" style="width: ${percent}%"></div>
      </div>
    `;
    els.categorySummary.append(card);
  });
}

function renderPurchases() {
  const totals = getCategoryTotals();
  const totalSpent = getTotalSpent();
  const overTotal = state.totalBudget > 0 && totalSpent > state.totalBudget;
  const categories = new Map(state.categories.map((category) => [category.id, category]));
  const purchases = getSortedPurchases();

  els.purchaseList.replaceChildren();
  els.emptyState.hidden = purchases.length > 0;
  els.purchaseCount.textContent = `${purchases.length} ${purchases.length === 1 ? "purchase" : "purchases"}`;

  purchases.forEach((purchase) => {
    const category = categories.get(purchase.categoryId) || { name: "Uncategorized", budget: 0 };
    const categorySpent = totals.get(purchase.categoryId) || 0;
    const overCategory = category.budget > 0 && categorySpent > category.budget;
    const over = overTotal || overCategory;

    const card = document.createElement("article");
    card.className = `card grid grid-cols-[1fr_auto] gap-2 p-2.5 ${over ? "status-bad" : "status-good"}`;
    card.innerHTML = `
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h3 class="truncate text-sm font-black">${escapeHtml(purchase.name)}</h3>
          <span class="shrink-0 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-black uppercase">${over ? "Over" : "Good"}</span>
        </div>
        <p class="mt-0.5 text-xs font-semibold opacity-80">${escapeHtml(category.name || "Untitled")} - ${formatDate(purchase.date)}</p>
      </div>
      <div class="text-right">
        <p class="text-base font-black">${formatMoney(purchase.price)}</p>
        <button class="mt-1 text-xs font-black opacity-80" type="button" data-delete="${purchase.id}">Delete</button>
      </div>
    `;
    els.purchaseList.append(card);
  });

  els.purchaseList.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      state.purchases = state.purchases.filter((purchase) => purchase.id !== button.dataset.delete);
      saveAndRender();
    });
  });
}

function getSortedPurchases() {
  const purchases = [...state.purchases];
  const sorters = {
    newest: (a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt),
    oldest: (a, b) => new Date(a.date) - new Date(b.date) || new Date(a.createdAt) - new Date(b.createdAt),
    priceHigh: (a, b) => b.price - a.price,
    priceLow: (a, b) => a.price - b.price,
  };

  return purchases.sort(sorters[state.sortMode] || sorters.newest);
}

function getTotalSpent() {
  return state.purchases.reduce((total, purchase) => total + purchase.price, 0);
}

function getCategoryTotals() {
  return state.purchases.reduce((totals, purchase) => {
    totals.set(purchase.categoryId, (totals.get(purchase.categoryId) || 0) + purchase.price);
    return totals;
  }, new Map());
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaultState();
    return { ...cloneDefaultState(), ...JSON.parse(raw) };
  } catch {
    return cloneDefaultState();
  }
}

function saveAndRender() {
  trySaveState();
  render();
}

function saveAndRenderQuietly() {
  trySaveState();
  els.totalBudget.value = state.totalBudget || "";
  renderBudgetHeader();
  renderPurchaseCategoryOptions();
  renderCategorySummary();
  renderPurchases();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function trySaveState() {
  try {
    saveState();
  } catch (error) {
    console.warn("Budget data could not be saved in this browser.", error);
  }
}

function normalizeState() {
  if (!Array.isArray(state.categories) || state.categories.length === 0) {
    state.categories = cloneDefaultState().categories;
  }

  state.categories = state.categories.map((category) => ({
    id: category.id || makeId(),
    name: category.name || "Untitled",
    budget: Number(category.budget) || 0,
  }));

  state.purchases = Array.isArray(state.purchases)
    ? state.purchases.map((purchase) => ({
        ...purchase,
        price: Number(purchase.price) || 0,
        createdAt: purchase.createdAt || new Date().toISOString(),
      }))
    : [];

  if (!state.sortMode) state.sortMode = "newest";
  if (!["purchases", "health"].includes(state.activePage)) state.activePage = "purchases";
}

function syncTotalBudgetFromCategories() {
  const categoryBudgetTotal = state.categories.reduce((total, category) => total + (Number(category.budget) || 0), 0);
  if (categoryBudgetTotal > 0) {
    state.totalBudget = categoryBudgetTotal;
  }
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseMoney(value) {
  return Math.max(0, Number.parseFloat(value) || 0);
}

function formatMoney(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getDaysRemainingInCycle() {
  const cycleLength = 14;
  const dayMs = 24 * 60 * 60 * 1000;
  const today = startOfDay(new Date());
  let resetDay = startOfDay(new Date("2026-05-29T00:00:00"));

  while (resetDay < today) {
    resetDay = new Date(resetDay.getTime() + cycleLength * dayMs);
  }

  const days = Math.ceil((resetDay - today) / dayMs);
  return Math.max(0, Math.min(cycleLength, days || cycleLength));
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
