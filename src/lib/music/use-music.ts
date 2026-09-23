import { useContext } from "react";
import { MusicContext, type MusicContextValue } from "./context.ts";

export function useMusic(): MusicContextValue {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used within a MusicProvider");
  return ctx;
}
