import {AdminPanelProvider} from "./context/AdminPanelContext";
import AdminPanelContent from "./components/AdminPanelContent";
import {useAdminPanelController} from "./controller/useAdminPanelController";

export default function AdminPanel() {
    const controller = useAdminPanelController();

    return (
        <AdminPanelProvider value={controller}>
            <AdminPanelContent/>
        </AdminPanelProvider>
    );
}
