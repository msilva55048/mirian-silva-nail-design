import {getWaitingPreferences, type WaitingPreferences} from "./waitingPreferences";

export function WaitingPreferencesSummary({entry}: {entry: WaitingPreferences}) {
    const {dates, times} = getWaitingPreferences(entry);
    return <div className="admin-waiting-preferences-summary">
        <span>Datas de interesse: {dates.length ? dates.map((date) => date.slice(5).split("-").reverse().join("/")).join(" · ") : "Não informadas"}</span>
        <span>Horários de interesse: {times.length ? times.join(" · ") : "Não informados"}</span>
    </div>;
}
