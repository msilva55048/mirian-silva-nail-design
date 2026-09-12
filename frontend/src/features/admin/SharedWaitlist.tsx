import {useCallback, useEffect, useMemo, useState} from "react";
import {supabase} from "../../lib/supabase";
import {formatCurrency, formatDateForInput} from "../../shared/domain";
import type {ClientProfile} from "./types";

type Service = {id: number; name: string; duration_minutes: number; price_cents: number};
type Request = {id: string; client_id: string; service_name_snapshot: string; selected_date: string; source: string; status: string};
type Props = {profiles: ClientProfile[]; services: Service[]; onBook: (client: ClientProfile, service: string, date: string) => void};

export function SharedWaitlist({profiles, services, onBook}: Props) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [clientId, setClientId] = useState(""); const [serviceId, setServiceId] = useState(""); const [selectedDate, setSelectedDate] = useState("");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1)); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { const {data, error: loadError} = await supabase.rpc("admin_list_waitlist_requests", {p_include_history: true}); if (loadError) setError("Não foi possível carregar a lista compartilhada."); else setRequests((data ?? []) as Request[]); }, []);
  useEffect(() => { void load(); const channel = supabase.channel("shared-waitlist-admin").on("postgres_changes", {event: "*", schema: "public", table: "waiting_list_requests"}, () => void load()).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [load]);
  const byId = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  async function create() { if (!clientId || !serviceId || !selectedDate) { setError("Selecione cliente, serviço e data útil."); return; } setSaving(true); setError(""); const {error: saveError} = await supabase.rpc("admin_create_waitlist_request", {p_client_id: clientId, p_service_id: Number(serviceId), p_selected_date: selectedDate}); if (saveError) setError(saveError.code === "23505" ? "Esta cliente já está na lista para esse serviço nesta semana." : "Não foi possível criar a solicitação."); else { setSelectedDate(""); await load(); } setSaving(false); }
  async function cancel(id: string) { if (!window.confirm("Encerrar esta solicitação?")) return; const {error: cancelError} = await supabase.rpc("admin_cancel_waitlist_request", {p_request_id: id}); if (cancelError) setError("Não foi possível encerrar a solicitação."); else await load(); }
  const today = formatDateForInput(new Date()); const days = Array.from({length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()}, (_, i) => formatDateForInput(new Date(month.getFullYear(), month.getMonth(), i + 1)));
  return (<div className="admin-waiting-list">
    <h3>Nova solicitação compartilhada</h3>
    <div className="admin-manual-form">
      <label>Cliente<select value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Selecione a cliente</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name} · {profile.phone}</option>)}</select></label>
      <label>Serviço<select value={serviceId} onChange={(event) => setServiceId(event.target.value)}><option value="">Selecione o serviço</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.duration_minutes} min · {formatCurrency(service.price_cents)}</option>)}</select></label>
    </div>
    <div className="admin-manual-month-calendar admin-month-calendar--same-size"><div className="admin-manual-month-calendar__header"><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><strong>{month.toLocaleDateString("pt-BR", {month: "long", year: "numeric"})}</strong><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div><div className="admin-manual-month-calendar__weekdays">{["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((day) => <span key={day}>{day}</span>)}</div><div className="admin-manual-month-calendar__grid">{Array.from({length: month.getDay()}, (_, i) => <span className="is-empty" key={i}/>)}{days.map((date) => { const day = new Date(`${date}T12:00:00`).getDay(); const disabled = date < today || day === 0 || day === 6; return <button type="button" key={date} disabled={disabled} className={selectedDate === date ? "is-selected" : ""} onClick={() => setSelectedDate(date)}>{new Date(`${date}T12:00:00`).getDate()}</button>; })}</div></div>
    <button type="button" className="admin-dashboard-card" disabled={saving} onClick={() => void create()}>{saving ? "Salvando..." : "Adicionar à lista compartilhada"}</button>{error && <p className="admin-manual-form__error">{error}</p>}
    <h3>Solicitações compartilhadas</h3>
    {requests.map((request) => { const profile = byId.get(request.client_id); return <article className="admin-client-card" key={request.id}><strong>{profile?.full_name ?? "Cliente"}</strong><span>{profile?.phone ?? ""}</span><span>{request.service_name_snapshot} · {new Date(`${request.selected_date}T12:00:00`).toLocaleDateString("pt-BR")}</span><span>{request.source === "admin" ? "Admin" : "Cliente"} · {request.status === "active" ? "Ativa" : request.status === "cancelled" ? "Cancelada" : request.status}</span>{request.status === "active" && <div className="admin-client-card__actions"><button type="button" onClick={() => profile && onBook(profile, request.service_name_snapshot, request.selected_date)}>Agendar</button><button type="button" className="is-danger" onClick={() => void cancel(request.id)}>Encerrar</button></div>}</article>; })}
  </div>);
}
