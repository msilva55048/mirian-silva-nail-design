type Props = {
    name: string;
    phone: string;
    email?: string | null;
    onChange: () => void;
    hideChange?: boolean;
    disabled?: boolean;
};

export function SelectedClientCard({name, phone, email, onChange, hideChange = false, disabled = false}: Props) {
    return <div className="admin-selected-client">
        <div>
            <span>Cliente selecionada</span>
            <strong>{name}</strong>
            <small>{phone}{email ? ` • ${email}` : ""}</small>
        </div>
        <button type="button" hidden={hideChange} disabled={disabled} onClick={onChange}>Trocar</button>
    </div>;
}
