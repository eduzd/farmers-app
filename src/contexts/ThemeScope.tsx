import React, { createContext, useContext } from "react";

/**
 * Visual scope for a part of the app. "maya" switches colours, fonts, buttons, cards and
 * icons to the Maya-style marketplace theme (see constants/mayaTheme.ts). Screens outside
 * a scope keep the Farmers design system untouched.
 */
export type ThemeScopeName = "maya" | null;

const ThemeScopeContext = createContext<ThemeScopeName>(null);

export function useThemeScope(): ThemeScopeName {
  return useContext(ThemeScopeContext);
}

export function MayaScope({ children }: { children: React.ReactNode }) {
  return <ThemeScopeContext.Provider value="maya">{children}</ThemeScopeContext.Provider>;
}

/** Wraps a navigator screen so it (and everything it renders) uses the Maya marketplace theme. */
export function withMayaScope<P extends object>(Component: React.ComponentType<P>): React.ComponentType<P> {
  const Wrapped = (props: P) => (
    <MayaScope>
      <Component {...props} />
    </MayaScope>
  );
  Wrapped.displayName = `Maya(${Component.displayName || Component.name || "Screen"})`;
  return Wrapped;
}
