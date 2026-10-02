"use client";

import { useSyncExternalStore } from "react";
import { CART_KEY, parseCart } from "@/lib/cart";

const initial = { items: [], open: false };
let snapshot = initial;
let storedRaw;
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());

function getSnapshot() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (raw !== storedRaw) {
      storedRaw = raw;
      snapshot = { ...snapshot, items: parseCart(raw) };
    }
  } catch { /* Storage unavailable: retain the in-memory cart. */ }
  return snapshot;
}

function onStorage(event) {
  if (event.key === CART_KEY || event.key === null) {
    getSnapshot();
    emit();
  }
}

function subscribe(listener) {
  if (!listeners.size) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}

function save(items) {
  const raw = JSON.stringify({ version: 1, items });
  // Reject overflow just as we reject corrupted persisted data.
  if (parseCart(raw).length !== items.length) return;
  snapshot = { ...getSnapshot(), items };
  try {
    localStorage.setItem(CART_KEY, raw);
    storedRaw = raw;
  } catch { /* Storage unavailable: changes still work in memory. */ }
  emit();
}

function addItem(product) {
  const items = getSnapshot().items;
  const existing = items.find((item) => item.id === product.id);
  save(existing
    ? items.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
    : [...items, { id: product.id, name: product.name, price: product.price, quantity: 1 }]);
}

function removeItem(id) {
  save(getSnapshot().items.filter((item) => item.id !== id));
}

function changeQuantity(id, delta) {
  save(getSnapshot().items.flatMap((item) => {
    if (item.id !== id) return [item];
    const quantity = item.quantity + delta;
    return quantity < 1 ? [] : [{ ...item, quantity }];
  }));
}

function completeOrder(submitted) {
  // Keep items/quantities added while the request was in flight.
  save(getSnapshot().items.flatMap((item) => {
    const ordered = submitted.find((line) => line.id === item.id);
    const quantity = item.quantity - (ordered?.quantity ?? 0);
    return quantity > 0 ? [{ ...item, quantity }] : [];
  }));
}

function setOpen(open) {
  snapshot = { ...getSnapshot(), open };
  emit();
}

export function useCart() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  return {
    ...state,
    count: state.items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: state.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    addItem, removeItem, changeQuantity, completeOrder,
    openCart: () => setOpen(true),
    closeCart: () => setOpen(false),
  };
}
