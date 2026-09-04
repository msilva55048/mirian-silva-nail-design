import {useCallback, useEffect, useRef, useState} from "react";
import {supabase} from "../../lib/supabase";

export type WaitingListEntry = {id: string; client_id: string; created_at: string; preferred_date: string | null; preferred_time: string | null};

export function useWaitingList(enabled: boolean) {
    const [entries, setEntries] = useState<WaitingListEntry[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const revision = useRef(0);
    const reload = useCallback(async () => {
        const requestRevision = ++revision.current;
        try {
            const {data, error: loadError} = await supabase.from("waiting_list")
                .select("*").order("created_at").order("id");
            if (loadError) throw loadError;
            if (requestRevision !== revision.current) return;
            setEntries(data ?? []);
            setError("");
        } catch {
            if (requestRevision === revision.current) setError("Não foi possível carregar a lista de espera. Tente novamente.");
        } finally { if (requestRevision === revision.current) setLoading(false); }
    }, []);

    useEffect(() => {
        if (!enabled) return;
        const initialLoad = window.setTimeout(() => void reload(), 0);
        const channel = supabase.channel("admin-waiting-list")
            .on("postgres_changes", {event: "*", schema: "public", table: "waiting_list"}, () => void reload())
            .subscribe();
        // Também recupera alterações após reconexão ou suspensão do celular.
        const refresh = () => { if (document.visibilityState === "visible") void reload(); };
        window.addEventListener("focus", refresh);
        document.addEventListener("visibilitychange", refresh);
        const timer = window.setInterval(refresh, 30_000);
        const invalidatePendingLoads = () => { revision.current++; };
        return () => {
            invalidatePendingLoads();
            window.clearTimeout(initialLoad);
            void supabase.removeChannel(channel);
            window.removeEventListener("focus", refresh);
            document.removeEventListener("visibilitychange", refresh);
            window.clearInterval(timer);
        };
    }, [enabled, reload]);

    async function add(clientId: string, preferredDate: string, preferredTime: string) {
        if (busy) return false;
        revision.current++;
        setBusy(true);
        try {
            const {error: addError} = await supabase.from("waiting_list").insert({client_id: clientId, preferred_date: preferredDate, preferred_time: preferredTime});
            if (addError) {
                setError(addError.code === "23505" ? "Esta cliente já está na lista de espera." : "Não foi possível adicionar a cliente.");
                return false;
            }
            await reload();
            return true;
        } catch {
            setError("Não foi possível adicionar a cliente. Confira sua conexão.");
            return false;
        } finally { setBusy(false); }
    }

    async function remove(id: string) {
        revision.current++;
        setBusy(true);
        try {
            const {error: removeError} = await supabase.from("waiting_list").delete().eq("id", id);
            if (removeError) throw removeError;
            // Uma leitura iniciada antes da remoção não pode recolocar a entrada na tela.
            revision.current++;
            setEntries((current) => current.filter((entry) => entry.id !== id));
            setError("");
            return true;
        } catch {
            setError("Não foi possível remover a cliente da lista de espera. Tente novamente.");
            return false;
        } finally { setBusy(false); }
    }

    return {entries, error, loading, busy, reload, add, remove};
}
