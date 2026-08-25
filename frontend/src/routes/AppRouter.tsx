import AdminPanel from "../features/admin/AdminPanel";
import PublicSite from "../features/public/PublicSite";

export default function AppRouter() {
    const normalizedPath = window.location.pathname.replace(/\/+$/, "");

    return normalizedPath === "/admin" ? <AdminPanel/> : <PublicSite/>;
}
