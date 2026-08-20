import { useCallback, useEffect, useState } from 'react';
import type { Deal } from '../lib/api';

const STORAGE_KEY = 'angebote_cart_v1';

function read(): Deal[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useCart() {
  const [items, setItems] = useState<Deal[]>(read);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const toggle = useCallback((deal: Deal) => {
    setItems((current) =>
      current.some((item) => item.id === deal.id)
        ? current.filter((item) => item.id !== deal.id)
        : [...current, deal]
    );
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const total = items.reduce((sum, item) => sum + (item.price || 0), 0);

  return { items, toggle, remove, clear, total };
}
