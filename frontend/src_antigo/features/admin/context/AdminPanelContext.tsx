import {createContext, useContext, type ReactNode} from "react";
import type {AdminPanelController} from "../controller/useAdminPanelController";

const AdminPanelContext = createContext<AdminPanelController | null>(null);

export function AdminPanelProvider({value, children}: {value: AdminPanelController; children: ReactNode}) {
    return <AdminPanelContext.Provider value={value}>{children}</AdminPanelContext.Provider>;
}

export function useAdminPanelContext() {
    const context = useContext(AdminPanelContext);
    if (!context) throw new Error("AdminPanelContext indisponível.");
    return context;
}
