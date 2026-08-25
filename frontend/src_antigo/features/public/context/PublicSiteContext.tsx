import {createContext, useContext, type ReactNode} from "react";
import type {PublicSiteController} from "../controller/usePublicSiteController";

const PublicSiteContext = createContext<PublicSiteController | null>(null);

export function PublicSiteProvider({value, children}: {value: PublicSiteController; children: ReactNode}) {
    return <PublicSiteContext.Provider value={value}>{children}</PublicSiteContext.Provider>;
}

export function usePublicSiteContext() {
    const context = useContext(PublicSiteContext);
    if (!context) throw new Error("PublicSiteContext indisponível.");
    return context;
}
