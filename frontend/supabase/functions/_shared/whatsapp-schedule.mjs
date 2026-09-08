const zone = 'America/Sao_Paulo';
const parts = new Intl.DateTimeFormat('en-GB', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function localInstant(date, time='00:00:00') {
    const desired = Date.parse(`${date}T${time.length===5 ? time+':00' : time}Z`);
    if (!Number.isFinite(desired)) return NaN;
    let candidate = desired;
    for (let i=0;i<3;i++) {
        const p=Object.fromEntries(parts.formatToParts(new Date(candidate)).map(x=>[x.type,x.value]));
        const represented=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
        candidate += desired-represented;
    }
    return candidate;
}
function previousDate(date) {
    return new Date(Date.parse(`${date}T12:00:00Z`)-86400000).toISOString().slice(0,10);
}
export function scheduleFor(type, appointment) {
    if (!['reminder_40h','reminder_2h'].includes(type)) return null;
    const at=localInstant(appointment.appointment_date,String(appointment.start_time).slice(0,8));
    if (!Number.isFinite(at)) return null;
    if (type==='reminder_40h') return {
        prepareAt:at-40*3600000,
        scheduledFor:localInstant(previousDate(appointment.appointment_date),'08:00:00'),
        expiresAt:localInstant(appointment.appointment_date),
    };
    const due=at-2*3600000;
    return {prepareAt:-Infinity,scheduledFor:due,expiresAt:Math.min(due+3600000,at)};
}
export function eligibleAt(type, scheduled, now) {
    if (!Number.isFinite(scheduled) || now < scheduled) return false;
    // 08:00 until the following local midnight: catch-up keeps "amanhã" true.
    if (type==='reminder_40h') return now < scheduled+16*3600000;
    return type==='reminder_2h' && now < scheduled+3600000;
}
