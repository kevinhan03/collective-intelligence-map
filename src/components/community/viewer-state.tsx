"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Viewer } from "@/domain/types";
export type ViewerState = {
  viewer: Viewer | null;
  myState: {
    votes: Record<string, number>;
    saves: string[];
    followed: boolean;
  };
};
const empty: ViewerState = {
  viewer: null,
  myState: { votes: {}, saves: [], followed: false },
};
const Context = createContext({
  state: empty,
  setState: (_: ViewerState) => {
    void _;
  },
});
export function ViewerStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(empty);
  return (
    <Context.Provider value={{ state, setState }}>{children}</Context.Provider>
  );
}
export function HydrateViewer({ state }: { state: ViewerState }) {
  const { setState } = useContext(Context);
  useEffect(() => {
    setState(state);
  }, [state, setState]);
  return null;
}
const subscribeHydration = () => () => {};
export function useViewerState() {
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  const { state } = useContext(Context);
  // Personalization may hydrate before a streamed consumer. Keep that consumer's
  // first render consistent with the anonymous server shell.
  return hydrated ? state : empty;
}
