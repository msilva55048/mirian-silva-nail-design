import {useAdminPanelContext} from "../context/AdminPanelContext";

export default function AdminBackToTop() {
    const {
        scrollAdminToTop,
    } = useAdminPanelContext();

    return (
                    <button
                        className="admin-back-to-top"
                        type="button"
                        onClick={scrollAdminToTop}
                        aria-label="Voltar ao topo do painel"
                        title="Voltar ao topo"
                    >
                        ↑
                    </button>
                );
}
