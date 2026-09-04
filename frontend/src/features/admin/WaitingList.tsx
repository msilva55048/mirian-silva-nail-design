import {sortedUnique, togglePreference} from "./waitingPreferences";
import {WaitingPreferencesSummary} from "./WaitingPreferencesSummary";
import {SelectedClientCard} from "./SelectedClientCard";
import {formatDateForInput} from "../../shared/domain";
import {useState} from "react";
import type {AdminBookingClient, ClientProfile} from "./types";
import type {useWaitingList, WaitingListEntry} from "./useWaitingList";
import "./waitingList.css";

type Props = {
    profiles: ClientProfile[];
    list: ReturnType<typeof useWaitingList>;
    bookingOpen: boolean;
    getInterestTimes: (date: string) => string[];
    onBook: (entry: WaitingListEntry, client: AdminBookingClient) => void;
};

export function WaitingList({profiles, list, bookingOpen, onBook, getInterestTimes}: Props) {
    const [search, setSearch] = useState("");
    const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
    const [preferredDates, setPreferredDates] = useState<string[]>([]);
    const [preferredTimes, setPreferredTimes] = useState<string[]>([]);
    const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const today = formatDateForInput(new Date());
    const interestTimes = sortedUnique([...preferredDates.flatMap(getInterestTimes), ...preferredTimes]);
    const days = Array.from({length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()}, (_, index) => formatDateForInput(new Date(month.getFullYear(), month.getMonth(), index + 1)));
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
                <input value={search} onChange={(event) => {setSearch(event.target.value); setSelectedClient(null);}} placeholder="Nome ou telefone" disabled={list.loading || list.busy || bookingOpen}/>
            </label>
        </div>
        {selectedClient && <SelectedClientCard name={selectedClient.full_name} phone={selectedClient.phone} email={selectedClient.email}
            disabled={list.busy || bookingOpen} onChange={() => {setSelectedClient(null); setSearch("");}}/>}
        {query && !selectedClient && <div className="admin-waiting-list__results">
            {results.map((profile) => <button type="button" className="admin-dashboard-card" key={profile.id}
                disabled={list.loading || list.busy || bookingOpen}
                onClick={() => {setSelectedClient(profile); setSearch(profile.full_name);}}>
                <strong>{profile.full_name}</strong><span>{profile.phone} · Selecionar</span>
            </button>)}
            {!results.length && <p>Nenhuma cliente cadastrada encontrada.</p>}
        </div>}
        {selectedClient && <form className="admin-waiting-list__preferences admin-clients__search" onSubmit={async (event) => {
            event.preventDefault();
            if (selectedClient && preferredDates.length > 0 && preferredDates.every((date) => date >= today) && preferredTimes.length > 0 && await list.add(selectedClient.id, preferredDates, preferredTimes)) {
                setSearch(""); setSelectedClient(null); setPreferredDates([]); setPreferredTimes([]);
            }
        }}>
            <section aria-label="Datas de interesse">
                <strong>Datas de interesse</strong>
                <div className="admin-manual-month-calendar admin-month-calendar--same-size">
                    <div className="admin-manual-month-calendar__header">
                        <button type="button" aria-label="Mês anterior" disabled={list.busy || bookingOpen} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
                        <strong>{month.toLocaleDateString("pt-BR", {month: "long", year: "numeric"})}</strong>
                        <button type="button" aria-label="Próximo mês" disabled={list.busy || bookingOpen} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
                    </div>
                    <div className="admin-manual-month-calendar__weekdays">
                        {['DOM','SEG','TER','QUA','QUI','SEX','SÁB'].map((day) => <span key={day}>{day}</span>)}
                    </div>
                    <div className="admin-manual-month-calendar__grid">
                        {Array.from({length: month.getDay()}, (_, i) => <span className="is-empty" key={i}/>)}
                        {days.map((date, i) => <button type="button" key={date} aria-label={date.split("-").reverse().join("/")} aria-pressed={preferredDates.includes(date)}
                            disabled={date < today || list.busy || bookingOpen} className={preferredDates.includes(date) ? "is-selected" : date < today ? "is-past" : ""}
                            onClick={() => setPreferredDates((current) => togglePreference(current, date))}>{i + 1}</button>)}
                    </div>
                </div>
            </section>
            {preferredDates.length > 0 && <section aria-label="Horários de interesse">
                <strong>Horários de interesse</strong>
                <div className="admin-manual-times">
                    {interestTimes.map((time) => <button type="button" key={time} aria-pressed={preferredTimes.includes(time)}
                        className={preferredTimes.includes(time) ? "is-selected" : ""} disabled={list.busy || bookingOpen} onClick={() => setPreferredTimes((current) => togglePreference(current, time))}>{time}</button>)}
                </div>
            </section>}
            <WaitingPreferencesSummary entry={{preferred_dates: preferredDates, preferred_times: preferredTimes}}/>
            <p>Selecione pelo menos uma data e um horário. Toque novamente para desmarcar.</p>
            <button type="submit" className="admin-dashboard-card" disabled={!selectedClient || !preferredDates.length || !preferredTimes.length || preferredDates.some((date) => date < today) || list.loading || list.busy || bookingOpen}>Adicionar à lista de espera</button>
            <p>Datas e horários de interesse não reservam uma vaga.</p>
        </form>}
        {list.error && <div role="status"><p className="admin-manual-form__error">{list.error}</p><button type="button" className="admin-manual-form__cancel" onClick={() => void list.reload()}>Atualizar lista</button></div>}
        {list.loading ? <p>Carregando lista de espera...</p> : !list.entries.length && !list.error ? <p>Nenhuma cliente na lista de espera.</p> : null}
        <div className="admin-waiting-list__entries">
            {list.entries.map((entry) => {
                const profile = byId.get(entry.client_id);
                return <article key={entry.id} className="admin-client-card">
                    <div className="admin-waiting-list__identity"><strong>{profile?.full_name ?? "Carregando cadastro..."}</strong><span>{profile?.phone}</span>
                        <WaitingPreferencesSummary entry={entry}/>
                    </div>
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
