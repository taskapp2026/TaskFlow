import { useCallback, useRef } from "react";

export default function useSingleFlight() {
  const locks = useRef(new Set());

  return useCallback(async (key, action) => {
    if (locks.current.has(key)) return;
    locks.current.add(key);
    try {
      return await action();
    } finally {
      locks.current.delete(key);
    }
  }, []);
}
