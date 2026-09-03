import {useState} from "react";
import type {AdminBookingClient, ClientProfile} from "./types";
import type {useWaitingList, WaitingListEntry} from "./useWaitingList";
import "./waitingList.css";

type Props = {
    profiles: ClientProfile[];
    list: ReturnType<typeof useWaitingList>;
    bookingOpen: boolean;
    onBook: (entry: WaitingListEntry, client: AdminBookingClient) => void;
};

export function WaitingList({profiles, list, bookingOpen, onBook}: Props) {
    const [search, setSearch] = useState("");
    const query = search.trim().toLocaleLowerCase("pt-BR");
    const digits = search.replace(/\D/g, "");
    const results = query ? profiles.filter((profile) =>
        profile.full_name.toLocaleLowerCase("pt-BR").includes(query) ||
        (Boolean(digits) && profile.phone.replace(/\D/g, "").includes(digits)),
    ).slice(0, 8) : [];
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));
    return <div className="admin-waiting-list">
        <div className="admin-clients__search">
            <label>Adicionar cliente à lista de espera
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou telefone" disabled={list.loading || list.busy || bookingOpen}/>
            </label>
        </div>
        {query && <div className="admin-waiting-list__results">
            {results.map((profile) => <button type="button" className="admin-dashboard-card" key={profile.id}
                disabled={list.loading || list.busy || bookingOpen}
                onClick={async () => {if (await list.add(profile.id)) setSearch("");}}>
                <strong>{profile.full_name}</strong><span>{profile.phone} · Adicionar</span>
            </button>)}
            {!results.length && <p>Nenhuma cliente cadastrada encontrada.</p>}
        </div>}
        {list.error && <div role="status"><p className="admin-manual-form__error">{list.error}</p><button type="button" className="admin-manual-form__cancel" onClick={() => void list.reload()}>Atualizar lista</button></div>}
        {list.loading ? <p>Carregando lista de espera...</p> : !list.entries.length && !list.error ? <p>Nenhuma cliente na lista de espera.</p> : null}
        <div className="admin-waiting-list__entries">
            {list.entries.map((entry) => {
                const profile = byId.get(entry.client_id);
                return <article key={entry.id} className="admin-client-card">
                    <div className="admin-waiting-list__identity"><strong>{profile?.full_name ?? "Carregando cadastro..."}</strong><span>{profile?.phone}</span></div>
                    <div className="admin-client-card__actions">
                        <button type="button" disabled={!profile || list.busy || bookingOpen} onClick={() => {
                            if (profile) onBook(entry, {key: `profile:${profile.id}`, profileId: profile.id, name: profile.full_name, phone: profile.phone, email: profile.email ?? "", userId: profile.user_id});
                        }}>Agendar</button>
                        <button type="button" className="is-danger" disabled={list.busy || bookingOpen} onClick={() => {
                            if (window.confirm(`Remover ${profile?.full_name ?? "esta cliente"} da lista de espera? O cadastro será mantido.`)) void list.remove(entry.id);
                        }}>Remover da lista</button>
                    </div>
                </article>;
            })}
        </div>
    </div>;
}
