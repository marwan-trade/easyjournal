import { useEffect, useState } from 'react';

const listeners = new Set();
export function toast(text, kind = 'ok') {
  const item = { id: Math.random(), text, kind };
  listeners.forEach((fn) => fn(item));
}

export function Toasts() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const fn = (item) => {
      setItems((l) => [...l, item]);
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== item.id)), 3600);
    };
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return <div className="toasts" aria-live="polite">{items.map((i) => <div key={i.id} className={`toast ${i.kind}`}>{i.text}</div>)}</div>;
}
