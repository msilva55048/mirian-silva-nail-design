import AdminPanel from "../features/admin/AdminPanel";
import PublicSite from "../features/public/PublicSite";

export default function AppRouter() {
    const normalizedPath = window.location.pathname.replace(/\/+$/, "");

    if (normalizedPath === "/admin") {
        return <AdminPanel/>;
    }

    return <PublicSite/>;
}
