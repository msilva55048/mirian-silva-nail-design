import {useEffect, useMemo, useState} from "react";
import {supabase} from "./lib/supabase";
import "./App.css";

type Service = {
    name: string;
    description: string;
    duration: string;
    durationMinutes: number;
    price: string;
    priceCents: number;
};

type Appointment = {
    id: string;
    clientName: string;
    clientPhone: string;
    clientEmail: string;
    serviceName: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    status: "pending" | "confirmed" | "completed" | "cancelled" | "no-show";
};

type ScheduleBlock = {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    reason?: string;
};

type TimeInterval = {
    start: number;
    end: number;
};

type ScheduleTimeOverride = {
    id: string;
    override_date: string;
    start_time: string;
    is_available: boolean;
    created_at?: string;
    updated_at?: string;
};

const fallbackServices: Service[] = [
    {
        name: "Esmaltação em Gel Decorada",
        description:
            "Esmaltação em gel com decoração personalizada e acabamento exclusivo.",
        duration: "2h",
        durationMinutes: 120,
        price: "R$ 70,00",
        priceCents: 7000,
    },
    {
        name: "Esmaltação em Gel Básica",
        description:
            "Acabamento elegante, duradouro e com brilho intenso para suas unhas.",
        duration: "1h30",
        durationMinutes: 90,
        price: "R$ 60,00",
        priceCents: 6000,
    },
    {
        name: "Reparo de Unha (Unitário)",
        description:
            "Reparo rápido e cuidadoso para recuperar uma unha danificada.",
        duration: "20 min",
        durationMinutes: 20,
        price: "R$ 10,00",
        priceCents: 1000,
    },
];

function formatDateForInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function timeToMinutes(time: string) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function mergeIntervals(intervals: TimeInterval[]) {
    const sorted = [...intervals].sort((a, b) => a.start - b.start);

    return sorted.reduce<TimeInterval[]>((merged, current) => {
        const previous = merged[merged.length - 1];

        if (!previous || current.start > previous.end) {
            merged.push({...current});
            return merged;
        }

        previous.end = Math.max(previous.end, current.end);
        return merged;
    }, []);
}

function intervalsOverlap(
    firstStart: number,
    firstEnd: number,
    secondStart: number,
    secondEnd: number,
) {
    return firstStart < secondEnd && firstEnd > secondStart;
}

const CLIENT_WEEKDAY_START_MINUTES = [
    7 * 60,   // 07:00
    9 * 60,   // 09:00
    11 * 60,  // 11:00
    13 * 60,  // 13:00
    17 * 60,  // 17:00
    19 * 60,  // 19:00
    21 * 60,  // 21:00
] as const;

const CLIENT_WEEKEND_START_MINUTES = [
    7 * 60,   // 07:00
    9 * 60,   // 09:00
    11 * 60,  // 11:00
    13 * 60,  // 13:00
] as const;

const ADMIN_WEEKDAY_START_MINUTES = [
    7 * 60,        // 07:00
    7 * 60 + 30,   // 07:30
    8 * 60,        // 08:00
    8 * 60 + 30,   // 08:30
    9 * 60,        // 09:00
    9 * 60 + 30,   // 09:30
    10 * 60,       // 10:00
    10 * 60 + 30,  // 10:30
    11 * 60,       // 11:00
    11 * 60 + 30,  // 11:30
    12 * 60,       // 12:00
    12 * 60 + 30,  // 12:30
    13 * 60,       // 13:00
    17 * 60,       // 17:00
    17 * 60 + 30,  // 17:30
    18 * 60,       // 18:00
    18 * 60 + 30,  // 18:30
    19 * 60,       // 19:00
    19 * 60 + 30,  // 19:30
    20 * 60,       // 20:00
    20 * 60 + 30,  // 20:30
    21 * 60,       // 21:00
] as const;

const ADMIN_WEEKEND_START_MINUTES = [
    7 * 60,        // 07:00
    7 * 60 + 30,   // 07:30
    8 * 60,        // 08:00
    8 * 60 + 30,   // 08:30
    9 * 60,        // 09:00
    9 * 60 + 30,   // 09:30
    10 * 60,       // 10:00
    10 * 60 + 30,  // 10:30
    11 * 60,       // 11:00
    11 * 60 + 30,  // 11:30
    12 * 60,       // 12:00
    12 * 60 + 30,  // 12:30
    13 * 60,       // 13:00
] as const;

function isWeekendDate(date: string) {
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
}

function getFixedClientStartMinutes(date: string) {
    if (!date) return [] as number[];

    // ÚNICA fonte da grade pública de horários.
    // Todas as clientes, antigas ou novas, passam por esta mesma função.
    return isWeekendDate(date)
        ? [...CLIENT_WEEKEND_START_MINUTES]
        : [...CLIENT_WEEKDAY_START_MINUTES];
}

function getFixedAdminManualStartMinutes(date: string) {
    if (!date) return [] as number[];

    // Grade exclusiva do painel ADM para criar/editar agendamentos.
    return isWeekendDate(date)
        ? [...ADMIN_WEEKEND_START_MINUTES]
        : [...ADMIN_WEEKDAY_START_MINUTES];
}

function getConfiguredClientStartMinutes(
    date: string,
    overrides: ScheduleTimeOverride[] = [],
) {
    if (!date) return [] as number[];

    const baseStarts = getFixedClientStartMinutes(date);
    const dateOverrides = overrides.filter(
        (item) => item.override_date === date,
    );

    const removedStarts = new Set(
        dateOverrides
            .filter((item) => !item.is_available)
            .map((item) => timeToMinutes(String(item.start_time).slice(0, 5))),
    );

    const addedStarts = dateOverrides
        .filter((item) => item.is_available)
        .map((item) => timeToMinutes(String(item.start_time).slice(0, 5)));

    return [...new Set([...baseStarts, ...addedStarts])]
        .filter((start) => !removedStarts.has(start))
        .sort((a, b) => a - b);
}

function normalizeBrazilianPhoneDigits(value: string) {
    let digits = value.replace(/\D/g, "");

    // Se vier com código do país (+55), remove antes de formatar.
    // Ex.: 5548999999999 -> 48999999999.
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
        digits = digits.slice(2);
    }

    return digits.slice(0, 11);
}

function formatBrazilianPhone(value: string) {
    const digits = normalizeBrazilianPhoneDigits(value);

    if (digits.length <= 2) {
        return digits.length ? `(${digits}` : "";
    }

    if (digits.length <= 6) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }

    if (digits.length <= 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCurrency(priceCents: number) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(priceCents / 100);
}

function formatDuration(minutes: number) {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes ? `${hours}h${String(remainingMinutes).padStart(2, "0")}` : `${hours}h`;
}

type PublicClientProfile = {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    phone_digits: string;
    user_id: string;
};

type PublicClientAppointment = {
    id: string;
    client_id: string | null;
    service_name: string;
    appointment_date: string;
    start_time: string;
    duration_minutes: number;
    price_cents: number | null;
    status: "pending" | "confirmed" | "completed" | "cancelled" | "no-show";
    created_at: string;
};

const clientAccountStyles = `
.client-navbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}
.client-auth-button,
.client-account-button {
    border: 1px solid rgba(255,255,255,.55);
    border-radius: 999px;
    padding: 10px 15px;
    background: rgba(255,255,255,.12);
    color: #fff;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
    backdrop-filter: blur(8px);
}
.client-account-button {
    background: #fff;
    color: #6d3445;
}
.client-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    padding: 18px;
    background: rgba(31,19,23,.58);
    backdrop-filter: blur(7px);
}
.client-modal {
    position: relative;
    width: min(100%, 520px);
    max-height: calc(100vh - 36px);
    overflow: auto;
    box-sizing: border-box;
    border-radius: 24px;
    padding: 28px;
    background: #fff;
    color: #35272c;
    box-shadow: 0 24px 80px rgba(33,17,22,.28);
}
.client-modal--account {
    width: min(100%, 760px);
}
.client-modal__close {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 38px;
    height: 38px;
    border: 0;
    border-radius: 50%;
    background: #f3e7ea;
    color: #6d3445;
    font-size: 1.35rem;
    cursor: pointer;
}
.client-modal__eyebrow {
    display: block;
    margin-bottom: 6px;
    color: #a05b70;
    font-size: .75rem;
    font-weight: 900;
    letter-spacing: .12em;
    text-transform: uppercase;
}
.client-modal h2 {
    margin: 0;
    color: #392a2f;
}
.client-modal > p {
    margin: 8px 0 22px;
    color: #80666e;
    line-height: 1.5;
}
.client-auth-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-bottom: 20px;
    padding: 5px;
    border-radius: 14px;
    background: #f3e7ea;
}
.client-auth-tabs button {
    border: 0;
    border-radius: 10px;
    padding: 11px;
    background: transparent;
    color: #755961;
    font: inherit;
    font-weight: 850;
    cursor: pointer;
}
.client-auth-tabs button.is-active {
    background: #fff;
    color: #6d3445;
    box-shadow: 0 5px 16px rgba(83,48,58,.1);
}
.client-auth-form {
    display: grid;
    gap: 14px;
}
.client-auth-form label {
    display: grid;
    gap: 7px;
    color: #5f454d;
    font-size: .85rem;
    font-weight: 800;
}
.client-auth-form input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #dbc5cc;
    border-radius: 12px;
    padding: 12px 13px;
    background: #fff;
    color: #35272c;
    font: inherit;
}
.client-password-field {
    position: relative;
}
.client-password-field input {
    padding-right: 88px;
}

.client-week-picker {
    display: grid;
    gap: 14px;
    margin-top: 14px;
}
.client-week-picker__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}
.client-week-picker__month {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #4d363e;
    font-weight: 900;
    text-transform: capitalize;
}
.client-week-picker__calendar-button,
.client-week-picker__nav {
    border: 1px solid #dbc5cc;
    border-radius: 11px;
    background: #fff;
    color: #6d3445;
    font: inherit;
    font-weight: 900;
    cursor: pointer;
}
.client-week-picker__calendar-button {
    padding: 9px 12px;
}
.client-week-picker__nav {
    width: 40px;
    height: 40px;
    padding: 0;
    font-size: 1.15rem;
}
.client-week-picker__navs {
    display: flex;
    gap: 7px;
}
.client-week-days {
    display: grid;
    gap: 6px;
    width: 100%;
    padding: 2px 1px 5px;
    overflow: visible;
}
.client-week-days__row {
    display: grid;
    gap: 6px;
    width: 100%;
}
.client-week-days__row--four {
    grid-template-columns: repeat(4, minmax(0, 1fr));
}
.client-week-days__row--three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
}
.client-week-day {
    width: 100%;
    min-width: 0;
    border: 1px solid #e0d0d5;
    border-radius: 12px;
    padding: 8px 5px;
    background: #fff;
    color: #5d464d;
    text-align: center;
    font: inherit;
    cursor: pointer;
}
.client-week-day strong,
.client-week-day span {
    display: block;
}
.client-week-day span {
    font-size: .66rem;
    font-weight: 850;
    text-transform: capitalize;
    color: #8a7078;
}
.client-week-day strong {
    margin-top: 3px;
    font-size: .88rem;
}
.client-week-day.is-selected {
    border-color: #9a5368;
    background: #f7e9ed;
    color: #6d3445;
    box-shadow: 0 0 0 2px rgba(154,83,104,.12);
}
.client-week-day.is-selected span {
    color: #9a5368;
}
.client-week-day.is-past {
    opacity: .42;
    cursor: not-allowed;
}
.client-week-times {
    display: grid;
    gap: 8px;
}
.client-week-times__title {
    margin: 0;
    color: #4d363e;
    font-size: .84rem;
    font-weight: 900;
}
.client-week-times .booking-times {
    gap: 6px;
    grid-template-columns: repeat(auto-fit, minmax(62px, 1fr));
}
.client-week-times .booking-time {
    min-height: 36px;
    padding: 9px 8px;
    border-radius: 10px;
    font-size: .82rem;
}
.client-month-calendar {
    border: 1px solid #eadde1;
    border-radius: 18px;
    padding: 14px;
    background: #fff;
}
.client-month-calendar__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
}
.client-month-calendar__header strong {
    color: #4d363e;
    text-transform: capitalize;
}
.client-month-calendar__grid,
.client-month-calendar__weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 5px;
}
.client-month-calendar__weekdays span {
    padding: 4px 0;
    color: #9a7a84;
    font-size: .68rem;
    font-weight: 900;
    text-align: center;
    text-transform: uppercase;
}
.client-month-calendar__day {
    aspect-ratio: 1;
    border: 0;
    border-radius: 10px;
    background: #faf5f7;
    color: #5d464d;
    font: inherit;
    font-size: .78rem;
    cursor: pointer;
}
.client-month-calendar__day.is-selected {
    background: #8f3f58;
    color: #fff;
    font-weight: 900;
}
.client-month-calendar__day.is-past {
    opacity: .3;
    cursor: not-allowed;
}
.client-month-calendar__day.is-empty {
    visibility: hidden;
}
@media (max-width: 700px) {
    .client-week-picker__top {
        align-items: flex-start;
        flex-wrap: wrap;
    }
    .client-week-days {
        width: 100%;
        overflow: visible;
    }
    .client-week-day {
        width: 100%;
        min-width: 0;
    }
}

.client-password-toggle {
    position: absolute;
    top: 50%;
    right: 10px;
    transform: translateY(-50%);
    border: 0;
    border-radius: 9px;
    padding: 7px 9px;
    background: #f4e8eb;
    color: #6d3445;
    font: inherit;
    font-size: .76rem;
    font-weight: 900;
    cursor: pointer;
}
.client-auth-submit,
.client-account__primary,
.client-account__logout {
    border: 0;
    border-radius: 12px;
    padding: 13px 16px;
    font: inherit;
    font-weight: 900;
    cursor: pointer;
}
.client-auth-submit,
.client-account__primary {
    background: linear-gradient(135deg, #a86175, #6d3445);
    color: #fff;
}
.client-auth-submit:disabled {
    opacity: .6;
    cursor: wait;
}
.client-auth-message {
    margin: 0;
    border-radius: 12px;
    padding: 11px 12px;
    font-size: .86rem;
}
.client-auth-message.is-error {
    background: #fff0f1;
    color: #a02f3d;
}
.client-auth-message.is-success {
    background: #edf8f1;
    color: #287044;
}
.client-account__profile {
    display: grid;
    grid-template-columns: repeat(3, minmax(0,1fr));
    gap: 10px;
    margin: 20px 0;
}
.client-account__profile div {
    padding: 13px;
    border-radius: 14px;
    background: #faf5f7;
}
.client-account__profile span,
.client-account__profile strong {
    display: block;
}
.client-account__profile span {
    margin-bottom: 5px;
    color: #8a7078;
    font-size: .72rem;
    font-weight: 850;
    text-transform: uppercase;
}
.client-account__profile strong {
    overflow-wrap: anywhere;
    color: #4d363e;
    font-size: .9rem;
}
.client-account__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 24px;
}
.client-account__logout {
    background: #efe4e7;
    color: #6d3445;
}
.client-account__edit-profile {
    flex: 1 1 100%;
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) 28px;
    align-items: center;
    gap: 11px;
    width: 100%;
    border: 1px solid #ead9de;
    border-radius: 16px;
    padding: 12px 14px;
    background: linear-gradient(135deg, #fffafb, #f6e8ed);
    color: #563941;
    text-align: left;
    font: inherit;
    cursor: pointer;
    box-shadow: 0 7px 18px rgba(83, 48, 58, .05);
}
.client-account__edit-profile-icon {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 13px;
    background: #ead4db;
    color: #7d3d53;
    font-size: 1.1rem;
    font-weight: 900;
}
.client-account__edit-profile > span:nth-child(2) {
    min-width: 0;
    display: grid;
    gap: 2px;
}
.client-account__edit-profile strong {
    color: #55383f;
    font-size: .91rem;
}
.client-account__edit-profile small {
    color: #927780;
    font-size: .71rem;
}
.client-account__edit-profile-arrow {
    color: #8b5365;
    font-size: 1.35rem;
    font-weight: 900;
}
.client-profile-editor {
    width: min(540px, calc(100% - 28px));
}
.client-profile-editor__form {
    display: grid;
    gap: 14px;
}
.client-profile-editor__form label {
    display: grid;
    gap: 7px;
    color: #5f454d;
    font-size: .85rem;
    font-weight: 800;
}
.client-profile-editor__form input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #dbc5cc;
    border-radius: 12px;
    padding: 12px 13px;
    background: #fff;
    color: #35272c;
    font: inherit;
}
.client-profile-editor__form input:focus {
    outline: none;
    border-color: #a86175;
    box-shadow: 0 0 0 3px rgba(168, 97, 117, .1);
}
.client-profile-editor__hint {
    color: #9a7d86;
    font-weight: 500;
    font-size: .72rem;
}
.client-profile-editor__actions {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 9px;
    margin-top: 4px;
}
.client-profile-editor__save,
.client-profile-editor__cancel {
    border: 0;
    border-radius: 13px;
    padding: 13px 15px;
    font: inherit;
    font-weight: 900;
    cursor: pointer;
}
.client-profile-editor__save {
    background: linear-gradient(135deg, #8d4960, #6e3447);
    color: #fff;
}
.client-profile-editor__cancel {
    background: #eee4e7;
    color: #6d4853;
}
.client-profile-editor__save:disabled,
.client-profile-editor__cancel:disabled {
    opacity: .6;
    cursor: wait;
}
.client-account__section {
    margin-top: 22px;
}
.client-account__section h3 {
    margin: 0 0 12px;
    color: #4a343b;
}
.client-account__appointments {
    display: grid;
    gap: 10px;
}
.client-account__appointment {
    display: grid;
    grid-template-columns: minmax(0,1fr) auto;
    gap: 14px;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
    padding: 14px;
    border: 1px solid #eadde1;
    border-radius: 14px;
    background: #fff;
    color: inherit;
    text-align: left;
    font: inherit;
}
.client-account__appointment.is-editable {
    cursor: pointer;
    transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
}
.client-account__appointment.is-editable:hover {
    transform: translateY(-1px);
    border-color: #c995a5;
    box-shadow: 0 8px 22px rgba(83,48,58,.08);
}
.client-account__appointment-hint {
    margin-top: 7px !important;
    color: #9a5368 !important;
    font-weight: 800;
}
.client-account__appointment strong,
.client-account__appointment span {
    display: block;
}
.client-account__appointment span {
    margin-top: 4px;
    color: #80666e;
    font-size: .82rem;
}
.client-account__status {
    border-radius: 999px;
    padding: 7px 10px;
    background: #f3e7ea;
    color: #6d3445;
    font-size: .72rem;
    font-weight: 900;
    white-space: nowrap;
}
.client-edit-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    margin-top: 16px;
}
.client-edit-cancel {
    width: 100%;
    border: 1px solid #e0b8c2;
    border-radius: 13px;
    padding: 13px 16px;
    background: #fff1f3;
    color: #a23f4d;
    font: inherit;
    font-weight: 900;
    cursor: pointer;
}
.client-edit-cancel:disabled {
    opacity: .6;
    cursor: wait;
}
.client-edit-current {
    margin: 14px 0 4px;
    padding: 13px 14px;
    border-radius: 13px;
    background: #faf5f7;
    color: #6d4a55;
}
.client-edit-current strong,
.client-edit-current span {
    display: block;
}
.client-edit-current span {
    margin-bottom: 4px;
    font-size: .72rem;
    font-weight: 850;
    text-transform: uppercase;
    color: #9a6c79;
}

.client-account__empty {
    padding: 18px;
    border-radius: 14px;
    background: #faf5f7;
    color: #80666e;
    text-align: center;
}
.client-booking-gate {
    position: relative;
    overflow: hidden;
    padding: clamp(28px, 5vw, 46px);
    border: 1px solid rgba(125, 78, 91, 0.13);
    border-radius: 26px;
    background:
        radial-gradient(circle at top right, rgba(188, 112, 136, .18), transparent 20rem),
        linear-gradient(145deg, #fff, #fbf4f6);
    box-shadow: 0 20px 55px rgba(83, 48, 58, .09);
}
.client-booking-gate__badge {
    display: inline-flex;
    margin-bottom: 14px;
    border-radius: 999px;
    padding: 7px 11px;
    background: #f2e0e6;
    color: #8a465b;
    font-size: .72rem;
    font-weight: 900;
    letter-spacing: .09em;
    text-transform: uppercase;
}
.client-booking-gate h3 {
    max-width: 660px;
    margin: 0;
    color: #35272c;
    font-size: clamp(1.75rem, 4vw, 2.65rem);
    line-height: 1.08;
}
.client-booking-gate > p {
    max-width: 650px;
    margin: 15px 0 0;
    color: #755961;
    font-size: 1rem;
    line-height: 1.65;
}
.client-booking-gate__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 11px;
    margin-top: 24px;
}
.client-booking-gate__primary,
.client-booking-gate__secondary {
    border-radius: 13px;
    padding: 13px 18px;
    font: inherit;
    font-weight: 900;
    cursor: pointer;
}
.client-booking-gate__primary {
    border: 0;
    background: linear-gradient(135deg, #a86175, #6d3445);
    color: #fff;
    box-shadow: 0 10px 24px rgba(109, 52, 69, .2);
}
.client-booking-gate__secondary {
    border: 1px solid #d7c0c7;
    background: #fff;
    color: #6d3445;
}
.client-booking-gate__benefits {
    display: grid;
    grid-template-columns: repeat(3, minmax(0,1fr));
    gap: 10px;
    margin-top: 28px;
}
.client-booking-gate__benefits div {
    padding: 14px;
    border-radius: 14px;
    background: rgba(255,255,255,.8);
    border: 1px solid rgba(125, 78, 91, .09);
}
.client-booking-gate__benefits strong,
.client-booking-gate__benefits span {
    display: block;
}
.client-booking-gate__benefits strong {
    color: #5a3e47;
    font-size: .86rem;
}
.client-booking-gate__benefits span {
    margin-top: 4px;
    color: #8a7078;
    font-size: .75rem;
    line-height: 1.4;
}
.client-booking-panel {
    padding: clamp(22px, 4vw, 34px);
    border: 1px solid rgba(125, 78, 91, .13);
    border-radius: 24px;
    background: #fff;
    box-shadow: 0 18px 50px rgba(83,48,58,.08);
}
.client-booking-panel__welcome {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 18px;
    margin-bottom: 22px;
}
.client-booking-panel__welcome h3 {
    margin: 4px 0 0;
    color: #35272c;
    font-size: clamp(1.5rem, 3vw, 2rem);
}
.client-booking-panel__welcome p {
    margin: 8px 0 0;
    color: #80666e;
}
.client-booking-panel__account {
    border: 1px solid #dbc5cc;
    border-radius: 12px;
    padding: 10px 13px;
    background: #faf5f7;
    color: #6d3445;
    font: inherit;
    font-weight: 850;
    cursor: pointer;
    white-space: nowrap;
}
.client-booking-panel__identity {
    display: grid;
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap: 10px;
    margin-bottom: 20px;
}
.client-booking-panel__identity div {
    padding: 12px 13px;
    border-radius: 13px;
    background: #faf5f7;
}
.client-booking-panel__identity span,
.client-booking-panel__identity strong {
    display: block;
}
.client-booking-panel__identity span {
    margin-bottom: 4px;
    color: #8a7078;
    font-size: .7rem;
    font-weight: 850;
    text-transform: uppercase;
}
.client-booking-panel__identity strong {
    color: #4d363e;
    font-size: .87rem;
    overflow-wrap: anywhere;
}
.client-booking-panel__service {
    display: grid;
    gap: 8px;
}
.client-booking-panel__service label {
    color: #5f454d;
    font-size: .86rem;
    font-weight: 900;
}
.client-booking-panel__service select {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #dbc5cc;
    border-radius: 13px;
    padding: 13px 14px;
    background: #fff;
    color: #35272c;
    font: inherit;
}
.client-booking-panel__continue {
    width: 100%;
    margin-top: 17px;
    border: 0;
    border-radius: 13px;
    padding: 14px 18px;
    background: linear-gradient(135deg, #a86175, #6d3445);
    color: #fff;
    font: inherit;
    font-weight: 900;
    cursor: pointer;
}
.client-booking-panel__continue:disabled {
    opacity: .55;
    cursor: not-allowed;
}
.client-session-loading {
    padding: 32px;
    border-radius: 22px;
    background: #fff;
    color: #80666e;
    text-align: center;
    box-shadow: 0 16px 42px rgba(83,48,58,.06);
}
@media (max-width: 760px) {
    .client-booking-gate__benefits {
        grid-template-columns: 1fr;
    }
    .client-booking-panel__welcome {
        flex-direction: column;
    }
    .client-booking-panel__account {
        width: 100%;
    }
    .client-booking-panel__identity {
        grid-template-columns: 1fr;
    }
    .client-navbar-actions {
        gap: 5px;
    }
    .client-auth-button,
    .client-account-button {
        padding: 8px 10px;
        font-size: .78rem;
    }
    .client-account__profile {
        grid-template-columns: 1fr;
    }
    .client-account__appointment {
        grid-template-columns: 1fr;
    }
    .client-profile-editor__actions {
        grid-template-columns: 1fr;
    }
}
`;

function PublicSite() {
    const [bookingStep, setBookingStep] = useState(1);
    const [clientName, setClientName] = useState("");
    const [clientPhone, setClientPhone] = useState("");
    const [selectedService, setSelectedService] = useState("");
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedTime, setSelectedTime] = useState("");
    const [bookingError, setBookingError] = useState("");
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
    const [scheduleTimeOverrides, setScheduleTimeOverrides] = useState<ScheduleTimeOverride[]>([]);
    const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
    const [isConfirmingBooking, setIsConfirmingBooking] = useState(false);
    const [services, setServices] = useState<Service[]>(fallbackServices);
    const [clientUserId, setClientUserId] = useState<string | null>(null);
    const [clientUserEmail, setClientUserEmail] = useState("");
    const [clientProfile, setClientProfile] = useState<PublicClientProfile | null>(null);
    const [clientAppointments, setClientAppointments] = useState<PublicClientAppointment[]>([]);
    const [, setIsCheckingClientSession] = useState(true);
    const [isLoadingClientAccount, setIsLoadingClientAccount] = useState(false);
    const [showClientAuth, setShowClientAuth] = useState(false);
    const [showClientAccount, setShowClientAccount] = useState(false);
    const [showClientProfileEditor, setShowClientProfileEditor] = useState(false);
    const [profileEditName, setProfileEditName] = useState("");
    const [profileEditPhone, setProfileEditPhone] = useState("");
    const [profileEditEmail, setProfileEditEmail] = useState("");
    const [profileEditPassword, setProfileEditPassword] = useState("");
    const [profileEditPasswordConfirm, setProfileEditPasswordConfirm] = useState("");
    const [showProfileEditPassword, setShowProfileEditPassword] = useState(false);
    const [profileEditError, setProfileEditError] = useState("");
    const [profileEditSuccess, setProfileEditSuccess] = useState("");
    const [isSavingProfileEdit, setIsSavingProfileEdit] = useState(false);
    const [, setFocusClientAppointments] = useState(false);
    const [clientAuthMode, setClientAuthMode] = useState<"login" | "signup">("login");
    const [authFullName, setAuthFullName] = useState("");
    const [authPhone, setAuthPhone] = useState("");
    const [authEmail, setAuthEmail] = useState("");
    const [authPassword, setAuthPassword] = useState("");
    const [showAuthPassword, setShowAuthPassword] = useState(false);
    const [authError, setAuthError] = useState("");
    const [authSuccess, setAuthSuccess] = useState("");
    const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
    const [editingClientAppointment, setEditingClientAppointment] = useState<PublicClientAppointment | null>(null);
    const [isCancellingClientAppointment, setIsCancellingClientAppointment] = useState(false);
    const [weekReferenceDate, setWeekReferenceDate] = useState(() => formatDateForInput(new Date()));
    const [showMonthCalendar, setShowMonthCalendar] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    function normalizeRpcRow<T>(data: T | T[] | null): T | null {
        if (!data) return null;
        return Array.isArray(data) ? (data[0] ?? null) : data;
    }

    async function loadClientAppointments(profileId: string) {
        const {data, error} = await supabase.rpc("get_my_client_appointments");

        if (error) {
            console.error("Erro ao carregar agendamentos da cliente:", error);
            setClientAppointments([]);
            return;
        }

        const loaded = ((data ?? []) as PublicClientAppointment[])
            .filter((appointment) => appointment.client_id === profileId)
            .sort((a, b) => {
                const first = new Date(`${a.appointment_date}T${String(a.start_time).slice(0, 5)}:00`).getTime();
                const second = new Date(`${b.appointment_date}T${String(b.start_time).slice(0, 5)}:00`).getTime();
                return second - first;
            });

        setClientAppointments(loaded);
    }

    async function resolveClientProfile(user: {id: string; email?: string | null; user_metadata?: Record<string, unknown>}) {
        const {data: profileData, error: profileError} = await supabase.rpc("get_my_client_profile");

        if (profileError) {
            console.error("Erro ao carregar perfil da cliente:", profileError);
        }

        let profile = normalizeRpcRow<PublicClientProfile>(profileData as PublicClientProfile[] | PublicClientProfile | null);

        if (!profile) {
            const metadata = user.user_metadata ?? {};
            const metadataName = typeof metadata.full_name === "string" ? metadata.full_name : "";
            const metadataPhone = typeof metadata.phone === "string" ? metadata.phone : "";

            if (metadataName && metadataPhone) {
                const {data: claimedData, error: claimError} = await supabase.rpc("claim_client_profile", {
                    p_full_name: metadataName,
                    p_phone: metadataPhone,
                    p_email: user.email ?? null,
                });

                if (claimError) {
                    console.error("Erro ao vincular perfil da cliente:", claimError);
                    setAuthError("Sua conta foi autenticada, mas não foi possível vincular o perfil. Fale com a Mirian.");
                } else {
                    profile = normalizeRpcRow<PublicClientProfile>(claimedData as PublicClientProfile[] | PublicClientProfile | null);
                }
            }
        }

        setClientProfile(profile);

        if (profile) {
            setClientName(profile.full_name);
            setClientPhone(formatBrazilianPhone(profile.phone));
            await loadClientAppointments(profile.id);
        } else {
            setClientAppointments([]);
        }

        return profile;
    }

    async function loadAuthenticatedClient(user: {id: string; email?: string | null; user_metadata?: Record<string, unknown>}) {
        setIsLoadingClientAccount(true);
        setClientUserId(user.id);
        setClientUserEmail(user.email ?? "");
        await resolveClientProfile(user);
        setIsLoadingClientAccount(false);
    }

    useEffect(() => {
        let mounted = true;

        async function initializeClientSession() {
            const {data: {session}} = await supabase.auth.getSession();

            if (!mounted) return;

            if (session?.user) {
                await loadAuthenticatedClient(session.user);
            } else {
                setClientUserId(null);
                setClientUserEmail("");
                setClientProfile(null);
                setClientAppointments([]);
            }

            if (mounted) setIsCheckingClientSession(false);
        }

        void initializeClientSession();

        const {data: authListener} = supabase.auth.onAuthStateChange((_event, session) => {
            window.setTimeout(() => {
                if (!mounted) return;

                if (session?.user) {
                    void loadAuthenticatedClient(session.user);
                } else {
                    setClientUserId(null);
                    setClientUserEmail("");
                    setClientProfile(null);
                    setClientAppointments([]);
                    setShowClientAccount(false);
                }

                setIsCheckingClientSession(false);
            }, 0);
        });

        return () => {
            mounted = false;
            authListener.subscription.unsubscribe();
        };
    }, []);

    function resetAuthMessages() {
        setAuthError("");
        setAuthSuccess("");
    }

    function openClientAuth(mode: "login" | "signup") {
        setClientAuthMode(mode);
        setShowAuthPassword(false);
        resetAuthMessages();
        setShowClientAuth(true);
    }

    async function submitClientAuth(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        resetAuthMessages();

        const email = authEmail.trim().toLowerCase();
        const password = authPassword;
        const phoneDigits = authPhone.replace(/\D/g, "");
        const fullName = authFullName.trim().replace(/\s+/g, " ");

        if (!email || !password) {
            setAuthError("Informe e-mail e senha.");
            return;
        }

        if (password.length < 6) {
            setAuthError("A senha precisa ter pelo menos 6 caracteres.");
            return;
        }

        if (clientAuthMode === "signup") {
            if (fullName.length < 3) {
                setAuthError("Informe seu nome completo.");
                return;
            }

            if (phoneDigits.length < 10 || phoneDigits.length > 11) {
                setAuthError("Informe um telefone válido com DDD.");
                return;
            }
        }

        setIsSubmittingAuth(true);

        try {
            if (clientAuthMode === "signup") {
                const formattedPhone = formatBrazilianPhone(phoneDigits);

                // A Mirian já possui uma conta no Supabase Auth usada pelo painel ADM.
                // Em vez de tentar criar um segundo usuário com o mesmo e-mail,
                // autenticamos a conta existente e vinculamos também um perfil de cliente.
                if (email === MIRIAN_ADMIN_EMAIL) {
                    const {data: adminClientData, error: adminClientError} =
                        await supabase.auth.signInWithPassword({
                            email,
                            password,
                        });

                    if (adminClientError || !adminClientData.user) {
                        setAuthError(
                            "Para cadastrar a Mirian como cliente, informe a mesma senha usada no acesso ADM.",
                        );
                        return;
                    }

                    const {error: claimError} = await supabase.rpc("claim_client_profile", {
                        p_full_name: fullName,
                        p_phone: formattedPhone,
                        p_email: email,
                    });

                    if (claimError) {
                        console.error("Erro ao criar/vincular o perfil de cliente da Mirian:", claimError);
                        throw claimError;
                    }

                    await loadAuthenticatedClient(adminClientData.user);
                    setShowClientAuth(false);
                    setShowClientAccount(false);
                    setShowAuthPassword(false);
                    setAuthPassword("");
                    return;
                }

                const {data, error} = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            phone: formattedPhone,
                        },
                    },
                });

                if (error) throw error;

                if (data.session?.user) {
                    await loadAuthenticatedClient(data.session.user);
                    setShowClientAuth(false);
                    setShowClientAccount(false);
                    setShowAuthPassword(false);
                    setAuthPassword("");
                } else {
                    setAuthSuccess("Conta criada. Confira seu e-mail para confirmar o cadastro e depois faça login.");
                    setAuthPassword("");
                }
            } else {
                const {data, error} = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) throw error;

                if (data.user) {
                    await loadAuthenticatedClient(data.user);
                }

                setShowClientAuth(false);
                setShowClientAccount(false);
                setShowAuthPassword(false);
                setAuthPassword("");
            }
        } catch (error) {
            console.error("Erro na autenticação da cliente:", error);
            setAuthError(
                clientAuthMode === "signup"
                    ? "Não foi possível criar a conta. Verifique os dados ou tente outro e-mail."
                    : "E-mail ou senha inválidos.",
            );
        } finally {
            setIsSubmittingAuth(false);
        }
    }

    function openClientProfileEditor() {
        if (!clientProfile) return;

        setProfileEditName(clientProfile.full_name);
        setProfileEditPhone(formatBrazilianPhone(clientProfile.phone));
        setProfileEditEmail(clientProfile.email || clientUserEmail);
        setProfileEditPassword("");
        setProfileEditPasswordConfirm("");
        setShowProfileEditPassword(false);
        setProfileEditError("");
        setProfileEditSuccess("");
        setShowClientProfileEditor(true);
    }

    function closeClientProfileEditor() {
        if (isSavingProfileEdit) return;

        setShowClientProfileEditor(false);
        setProfileEditPassword("");
        setProfileEditPasswordConfirm("");
        setProfileEditError("");
        setProfileEditSuccess("");
    }

    async function saveClientProfileChanges(
        event: React.FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (!clientProfile || !clientUserId) return;

        setProfileEditError("");
        setProfileEditSuccess("");

        const fullName = profileEditName.trim().replace(/\s+/g, " ");
        const phone = formatBrazilianPhone(profileEditPhone);
        const phoneDigits = phone.replace(/\D/g, "");
        const email = profileEditEmail.trim().toLowerCase();
        const newPassword = profileEditPassword;

        if (fullName.length < 3) {
            setProfileEditError("Informe seu nome completo.");
            return;
        }

        if (phoneDigits.length < 10 || phoneDigits.length > 11) {
            setProfileEditError("Informe um telefone válido com DDD.");
            return;
        }

        if (!email || !email.includes("@")) {
            setProfileEditError("Informe um e-mail válido.");
            return;
        }

        if (newPassword && newPassword.length < 6) {
            setProfileEditError("A nova senha precisa ter pelo menos 6 caracteres.");
            return;
        }

        if (newPassword !== profileEditPasswordConfirm) {
            setProfileEditError("A confirmação da nova senha não confere.");
            return;
        }

        setIsSavingProfileEdit(true);

        try {
            const {data: profileData, error: profileError} = await supabase.rpc(
                "update_my_client_profile",
                {
                    p_full_name: fullName,
                    p_phone: phone,
                    p_email: email,
                },
            );

            if (profileError) {
                throw profileError;
            }

            const updatedProfile = normalizeRpcRow<PublicClientProfile>(
                profileData as
                    | PublicClientProfile[]
                    | PublicClientProfile
                    | null,
            );

            if (!updatedProfile) {
                throw new Error("O perfil atualizado não foi retornado.");
            }

            const authUpdates: {
                email?: string;
                password?: string;
                data: {
                    full_name: string;
                    phone: string;
                };
            } = {
                data: {
                    full_name: fullName,
                    phone,
                },
            };

            if (email !== clientUserEmail.trim().toLowerCase()) {
                authUpdates.email = email;
            }

            if (newPassword) {
                authUpdates.password = newPassword;
            }

            const {data: authData, error: authError} =
                await supabase.auth.updateUser(authUpdates);

            if (authError) {
                throw authError;
            }

            setClientProfile(updatedProfile);
            setClientName(updatedProfile.full_name);
            setClientPhone(formatBrazilianPhone(updatedProfile.phone));
            setClientUserEmail(
                authData.user?.email ?? updatedProfile.email ?? email,
            );

            await loadClientAppointments(updatedProfile.id);

            setProfileEditPassword("");
            setProfileEditPasswordConfirm("");

            const emailChanged =
                email !== clientUserEmail.trim().toLowerCase();

            setProfileEditSuccess(
                emailChanged
                    ? "Perfil atualizado. Se o Supabase solicitar confirmação do novo e-mail, confirme pelo link recebido."
                    : "Perfil atualizado com sucesso.",
            );
        } catch (error) {
            console.error("Erro ao atualizar perfil da cliente:", error);

            const message =
                error instanceof Error
                    ? error.message
                    : "Não foi possível atualizar o perfil.";

            if (
                message.toLowerCase().includes("duplicate") ||
                message.toLowerCase().includes("already") ||
                message.toLowerCase().includes("unique")
            ) {
                setProfileEditError(
                    "Este telefone ou e-mail já está vinculado a outra conta.",
                );
            } else {
                setProfileEditError(
                    "Não foi possível atualizar o perfil. Confira os dados e tente novamente.",
                );
            }
        } finally {
            setIsSavingProfileEdit(false);
        }
    }

    async function logoutClient() {
        await supabase.auth.signOut();
        setShowClientAccount(false);
        setShowClientProfileEditor(false);
        setClientProfile(null);
        setClientAppointments([]);
        setClientUserId(null);
        setClientUserEmail("");
        setClientName("");
        setClientPhone("");
    }

    function isClientAppointmentEditable(appointment: PublicClientAppointment) {
        if (appointment.status !== "confirmed" && appointment.status !== "pending") {
            return false;
        }

        const appointmentMoment = new Date(
            `${appointment.appointment_date}T${String(appointment.start_time).slice(0, 5)}:00`,
        );

        return appointmentMoment.getTime() > Date.now();
    }

    function openEditClientAppointment(appointment: PublicClientAppointment) {
        if (!isClientAppointmentEditable(appointment)) return;

        setEditingClientAppointment(appointment);
        setSelectedService(appointment.service_name);
        setSelectedDate(appointment.appointment_date);
        setWeekReferenceDate(appointment.appointment_date);
        setSelectedTime("");
        setBookingError("");
        setClientName(clientProfile?.full_name ?? "");
        setClientPhone(clientProfile ? formatBrazilianPhone(clientProfile.phone) : "");
        setShowClientAccount(false);
        setBookingStep(2);
    }

    async function cancelEditingClientAppointment() {
        if (!editingClientAppointment || !clientProfile) return;

        const confirmed = window.confirm(
            "Deseja realmente cancelar este agendamento? O horário ficará disponível para outra cliente.",
        );

        if (!confirmed) return;

        setIsCancellingClientAppointment(true);
        setBookingError("");

        try {
            const {error} = await supabase.rpc("cancel_my_appointment", {
                p_appointment_id: editingClientAppointment.id,
            });

            if (error) throw error;

            await loadClientAppointments(clientProfile.id);
            setEditingClientAppointment(null);
            setSelectedService("");
            setSelectedDate("");
            setSelectedTime("");
            setBookingStep(1);
            setShowClientAccount(true);
        } catch (error) {
            console.error("Erro ao cancelar agendamento:", error);
            setBookingError("Não foi possível cancelar o agendamento. Tente novamente.");
        } finally {
            setIsCancellingClientAppointment(false);
        }
    }

    function openClientAppointments() {
        setFocusClientAppointments(true);
        setShowClientAccount(true);

        window.setTimeout(() => {
            document.getElementById("client-account-appointments")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }, 80);
    }


    function getClientAppointmentStatusLabel(status: PublicClientAppointment["status"]) {
        if (status === "confirmed") return "Confirmado";
        if (status === "completed") return "Concluído";
        if (status === "cancelled") return "Cancelado";
        if (status === "no-show") return "Não compareceu";
        return "Pendente";
    }

    useEffect(() => {
        async function loadPublicSettings() {
            const {data: serviceData, error: serviceError} = await supabase
                .from("services")
                .select("id, name, description, duration_minutes, price_cents, display_order")
                .eq("is_active", true)
                .order("price_cents", {ascending: false})
                .order("name", {ascending: true});

            if (!serviceError && serviceData?.length) {
                setServices(
                    serviceData.map((service) => ({
                        name: service.name,
                        description: service.description ?? "",
                        duration: formatDuration(service.duration_minutes),
                        durationMinutes: service.duration_minutes,
                        price: formatCurrency(service.price_cents),
                        priceCents: service.price_cents,
                    })),
                );
            }
        }

        void loadPublicSettings();
    }, []);


    useEffect(() => {
        async function loadAppointments() {
            setIsLoadingAppointments(true);

            const [
                {data: appointmentData, error: appointmentError},
                {data: blockData, error: blockError},
                {data: overrideData, error: overrideError},
            ] = await Promise.all([
                supabase
                    .from("occupied_appointments")
                    .select(
                        "id, appointment_date, start_time, duration_minutes, status",
                    )
                    .neq("status", "cancelled"),
                supabase
                    .from("schedule_blocks")
                    .select("id, block_date, start_time, end_time, reason"),
                supabase
                    .from("schedule_time_overrides")
                    .select("id, override_date, start_time, is_available, created_at, updated_at"),
            ]);

            if (overrideError) {
                console.warn("Exceções de horário ainda não disponíveis:", overrideError);
            }

            if (appointmentError || blockError) {
                console.error(
                    "Erro ao carregar horários:",
                    appointmentError || blockError,
                );
                setBookingError(
                    "Não foi possível carregar os horários ocupados. Atualize a página e tente novamente.",
                );
                setIsLoadingAppointments(false);
                return;
            }

            const loadedAppointments: Appointment[] = (
                appointmentData ?? []
            ).map((appointment) => ({
                id: appointment.id,
                clientName: "",
                clientPhone: "",
                clientEmail: "",
                serviceName: "",
                date: appointment.appointment_date,
                startTime: String(appointment.start_time).slice(0, 5),
                durationMinutes: appointment.duration_minutes,
                status: appointment.status as Appointment["status"],
            }));

            const loadedBlocks: ScheduleBlock[] = (blockData ?? []).map(
                (block) => ({
                    id: block.id,
                    date: block.block_date,
                    startTime: String(block.start_time).slice(0, 5),
                    endTime: String(block.end_time).slice(0, 5),
                    reason: block.reason || "",
                }),
            );

            const loadedOverrides: ScheduleTimeOverride[] = (overrideData ?? []).map(
                (item) => ({
                    id: item.id,
                    override_date: item.override_date,
                    start_time: String(item.start_time).slice(0, 5),
                    is_available: Boolean(item.is_available),
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                }),
            );

            setAppointments(loadedAppointments);
            setScheduleBlocks(loadedBlocks);
            setScheduleTimeOverrides(loadedOverrides);
            setIsLoadingAppointments(false);
        }

        void loadAppointments();

        const appointmentsChannel = supabase
            .channel("public-appointments-updates")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "appointments",
                },
                () => {
                    void loadAppointments();
                },
            )
            .subscribe();

        const blocksChannel = supabase
            .channel("public-schedule-blocks-updates")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "schedule_blocks",
                },
                () => {
                    void loadAppointments();
                },
            )
            .subscribe();

        const scheduleOverridesChannel = supabase
            .channel("public-schedule-time-overrides-updates")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "schedule_time_overrides",
                },
                () => {
                    void loadAppointments();
                },
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(appointmentsChannel);
            void supabase.removeChannel(blocksChannel);
            void supabase.removeChannel(scheduleOverridesChannel);
        };
    }, []);

    const todayDate = new Date();
    const today = formatDateForInput(todayDate);

    const selectedServiceInformation = services.find(
        (service) => service.name === selectedService,
    );

    function parseLocalDate(date: string) {
        return new Date(`${date}T12:00:00`);
    }

    function addDays(date: Date, amount: number) {
        const result = new Date(date);
        result.setDate(result.getDate() + amount);
        return result;
    }

    function startOfCalendarWeek(date: Date) {
        const result = new Date(date);
        const day = result.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        result.setDate(result.getDate() + diffToMonday);
        return result;
    }

    function getWeekDates(referenceDate: string) {
        const start = startOfCalendarWeek(parseLocalDate(referenceDate));
        return Array.from({length: 7}, (_, index) => formatDateForInput(addDays(start, index)));
    }

    function selectBookingDate(date: string) {
        if (date < today) return;

        setSelectedDate(date);
        setWeekReferenceDate(date);
        setSelectedTime("");
        setBookingError("");
        setShowMonthCalendar(false);
    }

    function moveBookingWeek(amount: number) {
        const currentStart = startOfCalendarWeek(parseLocalDate(weekReferenceDate));
        const nextReference = formatDateForInput(addDays(currentStart, amount * 7));
        setWeekReferenceDate(nextReference);

        const nextWeek = getWeekDates(nextReference);
        const firstSelectable = nextWeek.find((date) => date >= today);

        if (firstSelectable) {
            setSelectedDate(firstSelectable);
            setSelectedTime("");
            setBookingError("");
        }
    }

    function openMonthCalendar() {
        const reference = selectedDate || weekReferenceDate || today;
        const parsed = parseLocalDate(reference);
        setCalendarMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
        setShowMonthCalendar((current) => !current);
    }

    function moveCalendarMonth(amount: number) {
        setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
    }

    function getMonthCalendarCells() {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Grade começa na segunda-feira.
        const firstDayOfWeek = firstDay.getDay();
        const leadingEmpty = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

        return [
            ...Array.from({length: leadingEmpty}, () => null),
            ...Array.from({length: daysInMonth}, (_, index) => {
                const date = new Date(year, month, index + 1);
                return formatDateForInput(date);
            }),
        ];
    }

    const visibleWeekDates = useMemo(
        () => getWeekDates(weekReferenceDate),
        [weekReferenceDate],
    );

    function getOccupiedIntervals(date: string) {
        const appointmentIntervals = appointments
            .filter(
                (appointment) =>
                    appointment.date === date &&
                    appointment.id !== editingClientAppointment?.id &&
                    appointment.status !== "cancelled" &&
                    appointment.status !== "no-show",
            )
            .map((appointment) => {
                const start = timeToMinutes(appointment.startTime);
                return {start, end: start + appointment.durationMinutes};
            });

        const blockedIntervals = scheduleBlocks
            .filter((block) => block.date === date)
            .map((block) => ({
                start: timeToMinutes(block.startTime),
                end: timeToMinutes(block.endTime),
            }));

        return mergeIntervals([...appointmentIntervals, ...blockedIntervals]);
    }

    function isPastTime(date: string, startMinutes: number) {
        if (date !== today) return false;

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        return startMinutes <= currentMinutes;
    }

    function getConfiguredPublicStartMinutes(date: string) {
        return getConfiguredClientStartMinutes(date, scheduleTimeOverrides);
    }

    function getAvailableTimes(date: string, serviceDurationMinutes: number) {
        if (!date) return [];

        const occupiedIntervals = getOccupiedIntervals(date);
        const generatedTimes = getConfiguredPublicStartMinutes(date);

        return generatedTimes
            .filter((start) => {
                const end = start + serviceDurationMinutes;

                const hasConflict = occupiedIntervals.some((interval) =>
                    intervalsOverlap(start, end, interval.start, interval.end),
                );

                return !hasConflict && !isPastTime(date, start);
            })
            .map(minutesToTime);
    }

    const availableTimes = useMemo(() => {
        if (!selectedServiceInformation || !selectedDate) return [];

        return getAvailableTimes(
            selectedDate,
            selectedServiceInformation.durationMinutes,
        );
    }, [
        appointments,
        scheduleBlocks,
        scheduleTimeOverrides,
        selectedDate,
        selectedServiceInformation,
        editingClientAppointment,
    ]);

    function formatSelectedDate() {
        if (!selectedDate) return "";

        return new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
        });
    }

    function selectService(serviceName: string) {
        setSelectedService(serviceName);
        setSelectedDate("");
        setSelectedTime("");
        setBookingError("");
    }

    function closeBooking() {
        setBookingStep(1);
        setClientName(clientProfile?.full_name ?? "");
        setClientPhone(clientProfile ? formatBrazilianPhone(clientProfile.phone) : "");
        setSelectedService("");
        setSelectedDate("");
        setSelectedTime("");
        setWeekReferenceDate(formatDateForInput(new Date()));
        setShowMonthCalendar(false);
        setEditingClientAppointment(null);
        setBookingError("");
    }

    async function confirmBooking() {
        setBookingError("");

        if (!selectedServiceInformation || !selectedDate || !selectedTime) {
            setBookingError("Revise o serviço, a data e o horário selecionados.");
            return;
        }

        setIsConfirmingBooking(true);

        try {
            const [
                {data: latestAppointments, error: appointmentLoadError},
                {data: latestBlocks, error: blockLoadError},
                {data: latestOverrides, error: overrideLoadError},
            ] = await Promise.all([
                supabase
                    .from("occupied_appointments")
                    .select(
                        "id, appointment_date, start_time, duration_minutes, status",
                    )
                    .eq("appointment_date", selectedDate)
                    .neq("status", "cancelled"),
                supabase
                    .from("schedule_blocks")
                    .select("id, block_date, start_time, end_time, reason")
                    .eq("block_date", selectedDate),
                supabase
                    .from("schedule_time_overrides")
                    .select("id, override_date, start_time, is_available, created_at, updated_at")
                    .eq("override_date", selectedDate),
            ]);

            if (overrideLoadError) {
                console.warn("Não foi possível revalidar exceções de horário:", overrideLoadError);
            }

            if (appointmentLoadError || blockLoadError) {
                throw appointmentLoadError || blockLoadError;
            }

            const appointmentsForSelectedDate: Appointment[] = (
                latestAppointments ?? []
            ).map((appointment) => ({
                id: appointment.id,
                clientName: "",
                clientPhone: "",
                clientEmail: "",
                serviceName: "",
                date: appointment.appointment_date,
                startTime: String(appointment.start_time).slice(0, 5),
                durationMinutes: appointment.duration_minutes,
                status: appointment.status as Appointment["status"],
            }));

            const blocksForSelectedDate: ScheduleBlock[] = (
                latestBlocks ?? []
            ).map((block) => ({
                id: block.id,
                date: block.block_date,
                startTime: String(block.start_time).slice(0, 5),
                endTime: String(block.end_time).slice(0, 5),
                reason: block.reason || "",
            }));

            const latestDateOverrides: ScheduleTimeOverride[] = (latestOverrides ?? []).map(
                (item) => ({
                    id: item.id,
                    override_date: item.override_date,
                    start_time: String(item.start_time).slice(0, 5),
                    is_available: Boolean(item.is_available),
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                }),
            );

            if (!overrideLoadError) {
                setScheduleTimeOverrides((current) => [
                    ...current.filter((item) => item.override_date !== selectedDate),
                    ...latestDateOverrides,
                ]);
            }

            const selectedStart = timeToMinutes(selectedTime);
            const selectedEnd =
                selectedStart + selectedServiceInformation.durationMinutes;

            const allowedPublicStarts = overrideLoadError
                ? getConfiguredPublicStartMinutes(selectedDate)
                : getConfiguredClientStartMinutes(selectedDate, latestDateOverrides);

            if (!allowedPublicStarts.includes(selectedStart)) {
                setSelectedTime("");
                setBookingStep(3);
                setBookingError(
                    "Este horário não faz parte da agenda disponível da Mirian. Escolha outro horário.",
                );
                return;
            }

            const hasAppointmentConflict =
                appointmentsForSelectedDate.some((appointment) => {
                    if (appointment.id === editingClientAppointment?.id) {
                        return false;
                    }

                    const appointmentStart = timeToMinutes(
                        appointment.startTime,
                    );
                    const appointmentEnd =
                        appointmentStart + appointment.durationMinutes;

                    return intervalsOverlap(
                        selectedStart,
                        selectedEnd,
                        appointmentStart,
                        appointmentEnd,
                    );
                });

            const hasBlockConflict = blocksForSelectedDate.some((block) =>
                intervalsOverlap(
                    selectedStart,
                    selectedEnd,
                    timeToMinutes(block.startTime),
                    timeToMinutes(block.endTime),
                ),
            );

            if (hasAppointmentConflict || hasBlockConflict) {
                setAppointments((currentAppointments) => [
                    ...currentAppointments.filter(
                        (appointment) => appointment.date !== selectedDate,
                    ),
                    ...appointmentsForSelectedDate,
                ]);
                setScheduleBlocks((currentBlocks) => [
                    ...currentBlocks.filter(
                        (block) => block.date !== selectedDate,
                    ),
                    ...blocksForSelectedDate,
                ]);
                setSelectedTime("");
                setBookingStep(3);
                setBookingError(
                    "Este horário acabou de ficar indisponível. Escolha outro horário.",
                );
                return;
            }

            if (editingClientAppointment) {
                const {error: rescheduleError} = await supabase.rpc("reschedule_my_appointment", {
                    p_appointment_id: editingClientAppointment.id,
                    p_new_date: selectedDate,
                    p_new_time: selectedTime,
                });

                if (rescheduleError) {
                    throw rescheduleError;
                }
            } else {
                const {error: insertError} = await supabase
                    .from("appointments")
                    .insert({
                        client_name: clientName.trim(),
                        client_phone: clientPhone.trim(),
                        client_email: (clientProfile?.email ?? clientUserEmail) || null,
                        client_id: clientProfile?.id ?? null,
                        service_name: selectedServiceInformation.name,
                        appointment_date: selectedDate,
                        start_time: selectedTime,
                        duration_minutes:
                        selectedServiceInformation.durationMinutes,
                        price_cents: selectedServiceInformation.priceCents,
                        status: "confirmed",
                    });

                if (insertError) {
                    throw insertError;
                }
            }

            if (!editingClientAppointment) {
                const newAppointment: Appointment = {
                    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                    clientName: clientName.trim(),
                    clientPhone: clientPhone.trim(),
                    clientEmail: clientProfile?.email ?? clientUserEmail,
                    serviceName: selectedServiceInformation.name,
                    date: selectedDate,
                    startTime: selectedTime,
                    durationMinutes: selectedServiceInformation.durationMinutes,
                    status: "confirmed",
                };

                setAppointments((currentAppointments) => [
                    ...currentAppointments,
                    newAppointment,
                ]);
            }

            if (clientProfile) {
                await loadClientAppointments(clientProfile.id);
            }

            setBookingStep(5);
        } catch (error) {
            console.error("Erro ao confirmar agendamento:", error);
            setBookingError(
                "Não foi possível salvar o agendamento online. Verifique sua conexão e tente novamente.",
            );
        } finally {
            setIsConfirmingBooking(false);
        }
    }

    return (
        <main className="home">
            <style>{clientAccountStyles}</style>
            <style>{`
                @media (max-width: 700px) {
                    .home {
                        min-height: 100dvh;
                        overflow-x: hidden;
                    }

                    .home > .hero {
                        min-height: auto !important;
                        height: auto !important;
                        padding-bottom: 28px !important;
                        margin-bottom: 0 !important;
                        box-sizing: border-box;
                    }

                    .home > .hero .hero__content {
                        padding-bottom: 0 !important;
                        margin-bottom: 0 !important;
                    }

                    .home > .hero .hero__content > div:last-of-type {
                        margin-bottom: 0 !important;
                    }
                }
            `}</style>

            {clientUserId && clientProfile ? (
                <div className="client-logged-page">

                    <style>{`
                .client-logged-page {
                    min-height: 100vh;
                    background: #fff8fa;
                    padding: 24px 0 64px;
                }
                .client-logged-header {
                    width: min(1160px, calc(100% - 32px));
                    margin: 0 auto 22px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    padding: 14px 16px;
                    border: 1px solid rgba(125, 78, 91, .12);
                    border-radius: 18px;
                    background: #fff;
                    box-shadow: 0 10px 28px rgba(83, 48, 58, .06);
                }
                .client-logged-header__brand {
                    display: flex;
                    align-items: center;
                    gap: 11px;
                }
                .client-logged-header__brand img {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    object-fit: cover;
                }
                .client-logged-header__brand strong,
                .client-logged-header__brand span {
                    display: block;
                }
                .client-logged-header__brand strong {
                    color: #4d363e;
                    font-size: .98rem;
                }
                .client-logged-header__brand span {
                    margin-top: 2px;
                    color: #8a7078;
                    font-size: .76rem;
                }
                .client-logged-header__actions {
                    display: flex;
                    width: min(440px, 100%);
                    flex: 1;
                }
                .client-logged-header__actions button {
                    width: 100%;
                    border: 0;
                    border-radius: 14px;
                    padding: 16px 18px;
                    font: inherit;
                    font-size: 1.02rem;
                    font-weight: 850;
                    cursor: pointer;
                }
                .client-logged-header__appointments {
                    background: #6d3445;
                    color: #fff;
                }
                .client-logged-page .services {
                    padding-top: 4px;
                }
                .client-logged-page .services__grid {
                    gap: 18px;
                }
                .client-logged-page .service-card {
                    padding: 28px 24px;
                    min-height: unset;
                }
                .client-logged-page .service-card__button {
                    width: 100%;
                    box-sizing: border-box;
                    cursor: pointer;
                    font: inherit;
                }
                @media (max-width: 700px) {
                    .client-logged-header {
                        align-items: flex-start;
                        flex-direction: column;
                    }
                    .client-logged-header__actions {
                        width: 100%;
                    }
                    .client-logged-header__actions button {
                        width: 100%;
                    }
                }
            `}</style>

                    <header className="client-logged-header">
                        <div className="client-logged-header__brand">
                            <img src="/logo-mirian.png" alt="Mirian Silva Nail Design" />
                            <div>
                                <strong>Mirian Silva Nail Design</strong>
                                <span>Olá, {clientProfile?.full_name.split(/\s+/)[0]}</span>
                            </div>
                        </div>

                        <div className="client-logged-header__actions">
                            <button
                                className="client-logged-header__appointments"
                                type="button"
                                onClick={openClientAppointments}
                            >
                                Meus agendamentos
                            </button>
                        </div>
                    </header>


                    <section className="services" id="servicos">
                        <div className="services__grid">
                            {services.map((service, index) => (
                                <article className="service-card" key={service.name}>
                                    <span className="service-card__number">{String(index + 1).padStart(2, "0")}</span>
                                    <div className="service-card__content"><h3>{service.name}</h3><p>{service.description}</p>
                                    </div>
                                    <div className="service-card__footer">
                                        <div><span>Duração</span><strong>{service.duration}</strong></div>
                                        <div><span>Valor</span><strong>{service.price}</strong></div>
                                    </div>
                                    <button
                                        type="button"
                                        className="service-card__button"
                                        onClick={() => {
                                            setEditingClientAppointment(null);
                                            selectService(service.name);
                                            const initialDate = formatDateForInput(new Date());
                                            setSelectedDate(initialDate);
                                            setWeekReferenceDate(initialDate);
                                            setClientName(clientProfile?.full_name ?? "");
                                            setClientPhone(clientProfile ? formatBrazilianPhone(clientProfile.phone) : "");
                                            setBookingStep(2);
                                        }}
                                    >
                                        Escolher este serviço
                                    </button>
                                </article>
                            ))}
                        </div>
                    </section>


                    {bookingStep === 2 && <div className="booking-modal">
                        <div className="booking-modal__content">
                            <button
                                className="booking-modal__close"
                                type="button"
                                onClick={() => {
                                    setBookingError("");
                                    setShowMonthCalendar(false);
                                    setBookingStep(1);
                                }}
                                aria-label="Fechar agenda"
                            >
                                ×
                            </button>

                            <span className="section-label">
                            {editingClientAppointment ? "Editar agendamento" : "Escolha data e horário"}
                        </span>
                            <h3>
                                {editingClientAppointment ? "Escolha o novo dia e horário" : "Quando fica melhor para você?"}
                            </h3>
                            <p>
                                Toque em qualquer dia da semana para ver os horários disponíveis sem precisar voltar.
                            </p>

                            {editingClientAppointment && (
                                <div className="client-edit-current">
                                    <span>Agendamento atual</span>
                                    <strong>
                                        {new Date(`${editingClientAppointment.appointment_date}T12:00:00`).toLocaleDateString("pt-BR")}
                                        {" às "}
                                        {String(editingClientAppointment.start_time).slice(0, 5)}
                                    </strong>
                                </div>
                            )}

                            <div className="client-week-picker">
                                <div className="client-week-picker__top">
                                    <div className="client-week-picker__month">
                                        <strong>
                                            {parseLocalDate(selectedDate || weekReferenceDate).toLocaleDateString("pt-BR", {
                                                month: "long",
                                                year: "numeric",
                                            })}
                                        </strong>
                                        <button
                                            className="client-week-picker__calendar-button"
                                            type="button"
                                            onClick={openMonthCalendar}
                                            aria-label="Abrir calendário do mês"
                                        >
                                            📅
                                        </button>
                                    </div>

                                    <div className="client-week-picker__navs">
                                        <button
                                            className="client-week-picker__nav"
                                            type="button"
                                            onClick={() => moveBookingWeek(-1)}
                                            aria-label="Semana anterior"
                                        >
                                            ‹
                                        </button>
                                        <button
                                            className="client-week-picker__nav"
                                            type="button"
                                            onClick={() => moveBookingWeek(1)}
                                            aria-label="Próxima semana"
                                        >
                                            ›
                                        </button>
                                    </div>
                                </div>

                                {showMonthCalendar && (
                                    <div className="client-month-calendar">
                                        <div className="client-month-calendar__header">
                                            <button
                                                className="client-week-picker__nav"
                                                type="button"
                                                onClick={() => moveCalendarMonth(-1)}
                                                aria-label="Mês anterior"
                                            >
                                                ‹
                                            </button>
                                            <strong>
                                                {calendarMonth.toLocaleDateString("pt-BR", {
                                                    month: "long",
                                                    year: "numeric",
                                                })}
                                            </strong>
                                            <button
                                                className="client-week-picker__nav"
                                                type="button"
                                                onClick={() => moveCalendarMonth(1)}
                                                aria-label="Próximo mês"
                                            >
                                                ›
                                            </button>
                                        </div>

                                        <div className="client-month-calendar__weekdays">
                                            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
                                                <span key={day}>{day}</span>
                                            ))}
                                        </div>

                                        <div className="client-month-calendar__grid">
                                            {getMonthCalendarCells().map((date, index) => {
                                                if (!date) {
                                                    return <span className="client-month-calendar__day is-empty" key={`empty-${index}`}/>;
                                                }

                                                const isPast = date < today;

                                                return (
                                                    <button
                                                        key={date}
                                                        type="button"
                                                        disabled={isPast}
                                                        className={[
                                                            "client-month-calendar__day",
                                                            date === selectedDate ? "is-selected" : "",
                                                            isPast ? "is-past" : "",
                                                        ].filter(Boolean).join(" ")}
                                                        onClick={() => selectBookingDate(date)}
                                                    >
                                                        {parseLocalDate(date).getDate()}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="client-week-days">
                                    {[
                                        {dates: visibleWeekDates.slice(0, 4), rowClass: "client-week-days__row--four"},
                                        {dates: visibleWeekDates.slice(4, 7), rowClass: "client-week-days__row--three"},
                                    ].map((row, rowIndex) => (
                                        <div
                                            className={`client-week-days__row ${row.rowClass}`}
                                            key={`week-row-${rowIndex}`}
                                        >
                                            {row.dates.map((date) => {
                                                const parsed = parseLocalDate(date);
                                                const isPast = date < today;

                                                return (
                                                    <button
                                                        key={date}
                                                        type="button"
                                                        disabled={isPast}
                                                        className={[
                                                            "client-week-day",
                                                            date === selectedDate ? "is-selected" : "",
                                                            isPast ? "is-past" : "",
                                                        ].filter(Boolean).join(" ")}
                                                        onClick={() => selectBookingDate(date)}
                                                    >
                                                    <span>
                                                        {parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}
                                                    </span>
                                                        <strong>
                                                            {parsed.toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit"})}
                                                        </strong>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>

                                <div className="client-week-times">
                                    <p className="client-week-times__title">
                                        {selectedDate
                                            ? `Horários disponíveis em ${parseLocalDate(selectedDate).toLocaleDateString("pt-BR")}`
                                            : "Escolha um dia"}
                                    </p>

                                    {bookingError && <p className="booking-modal__error">{bookingError}</p>}

                                    {isLoadingAppointments ? (
                                        <p>Carregando horários disponíveis...</p>
                                    ) : selectedDate && availableTimes.length > 0 ? (
                                        <div className="booking-times">
                                            {availableTimes.map((time) => (
                                                <button
                                                    key={time}
                                                    className={
                                                        selectedTime === time
                                                            ? "booking-time booking-time--selected"
                                                            : "booking-time"
                                                    }
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedTime(time);
                                                        setBookingError("");
                                                    }}
                                                >
                                                    {time}
                                                </button>
                                            ))}
                                        </div>
                                    ) : selectedDate ? (
                                        <div className="booking-times__empty">
                                            <strong>Nenhum horário disponível neste dia.</strong>
                                            <span>Toque em outro dia da semana para consultar os horários.</span>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="client-edit-actions">
                                    <button
                                        className="booking-modal__button"
                                        type="button"
                                        disabled={!selectedDate || !selectedTime}
                                        onClick={() => {
                                            setBookingError("");
                                            setBookingStep(4);
                                        }}
                                    >
                                        Revisar agendamento
                                    </button>

                                    {editingClientAppointment && (
                                        <button
                                            className="client-edit-cancel"
                                            type="button"
                                            disabled={isCancellingClientAppointment}
                                            onClick={() => void cancelEditingClientAppointment()}
                                        >
                                            {isCancellingClientAppointment ? "Cancelando..." : "Cancelar agendamento"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>}


                    {bookingStep === 4 && <div className="booking-modal">
                        <div className="booking-modal__content">
                            <button className="booking-modal__close" type="button" onClick={() => {
                                setBookingError("");
                                setBookingStep(2);
                            }} aria-label="Voltar para data e horários">←
                            </button>
                            <span className="section-label">{editingClientAppointment ? "Confirmar alteração" : "Confirmação"}</span>
                            <h3>{editingClientAppointment ? "Revise o novo dia e horário" : "Revise seu agendamento"}</h3>
                            <p>
                                {editingClientAppointment
                                    ? "Confira as novas informações antes de salvar a alteração."
                                    : "Confira as informações antes de confirmar a solicitação."}
                            </p>
                            <div className="booking-modal__summary">
                                <div><span>Cliente</span><strong>{clientName}</strong></div>
                                <div><span>Telefone</span><strong>{clientPhone}</strong></div>
                                <div><span>Serviço</span><strong>{selectedService}</strong></div>
                                <div><span>Data</span><strong>{formatSelectedDate()}</strong></div>
                                <div><span>Horário</span><strong>{selectedTime}</strong></div>
                                <div><span>Valor</span><strong>{selectedServiceInformation?.price ?? ""}</strong></div>
                            </div>
                            {bookingError && <p className="booking-modal__error">{bookingError}</p>}
                            <button className="booking-modal__button" type="button" disabled={isConfirmingBooking}
                                    onClick={confirmBooking}>
                                {isConfirmingBooking
                                    ? "Salvando..."
                                    : editingClientAppointment
                                        ? "Salvar novo dia e horário"
                                        : "Confirmar agendamento"}
                            </button>
                        </div>
                    </div>}


                    {bookingStep === 5 && <div className="booking-modal">
                        <div className="booking-modal__content booking-success">
                            <div className="booking-success__icon">✓</div>
                            <span className="section-label">{editingClientAppointment ? "Agendamento alterado" : "Agendamento realizado"}</span>
                            <h3>
                                {editingClientAppointment
                                    ? "Seu agendamento foi alterado com sucesso!"
                                    : "Seu agendamento foi confirmado com sucesso!"}
                            </h3>
                            <p>
                                {editingClientAppointment
                                    ? "O novo dia e horário já estão reservados para você."
                                    : `Obrigado, ${clientName}. Seu agendamento está confirmado e o horário já foi reservado para você.`}
                            </p>
                            <div className="booking-modal__summary">
                                <div><span>Serviço</span><strong>{selectedService}</strong></div>
                                <div><span>Data</span><strong>{formatSelectedDate()}</strong></div>
                                <div><span>Horário</span><strong>{selectedTime}</strong></div>
                                <div><span>Telefone</span><strong>{clientPhone}</strong></div>
                            </div>
                            <button className="booking-modal__button" type="button" onClick={closeBooking}>Finalizar
                            </button>
                        </div>
                    </div>}
                </div>

            ) : (
                <>
                    <section className="hero" id="inicio">
                        <div className="hero__overlay"/>

                        <header className="navbar">
                            <a className="brand" href="#inicio">
                                <span className="brand__symbol">
                                    <img
                                        src="/logo-mirian.png"
                                        alt="Logo Mirian Silva Nail Design"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            borderRadius: "50%",
                                            display: "block",
                                        }}
                                    />
                                </span>
                                <span className="brand__text">
                                    <strong>Mirian Silva</strong>
                                    <small>Nail Design</small>
                                </span>
                            </a>

                            <a className="navbar__button" href="/admin">
                                Login ADM
                            </a>
                        </header>

                        <div className="hero__content">
                            <span className="hero__eyebrow">Beleza em cada detalhe</span>
                            <h1>Mirian Silva<span>Nail Design</span></h1>
                            <p>Cuidados exclusivos para unhas elegantes, saudáveis e cheias de personalidade.</p>

                            <div className="hero__actions">
                                <button
                                    className="button button--primary"
                                    type="button"
                                    onClick={() => openClientAuth("signup")}
                                >
                                    Criar conta / Entrar
                                </button>

                                <a
                                    className="button button--instagram"
                                    href="https://www.instagram.com/nails.mirian.silva/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Instagram
                                </a>

                                <a
                                    className="button button--whatsapp"
                                    href="https://wa.me/5548998074518?text=Olá%2C%20Mirian!%20Gostaria%20de%20mais%20informações%20sobre%20os%20serviços."
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    WhatsApp
                                </a>
                            </div>

                            <div
                                style={{
                                    marginTop: "42px",
                                    paddingTop: "26px",
                                    textAlign: "center",
                                }}
                            >
                                <strong
                                    style={{
                                        display: "block",
                                        fontFamily:
                                            '"Cormorant Garamond", Georgia, "Times New Roman", serif',
                                        fontSize:
                                            "clamp(1.75rem, 6.4vw, 3.2rem)",
                                        fontWeight: 500,
                                        fontStyle: "italic",
                                        letterSpacing: "-0.015em",
                                        lineHeight: 1.02,
                                        color: "#c77f91",
                                    }}
                                >
                                    Suas unhas. Sua marca.
                                </strong>

                                <span
                                    style={{
                                        display: "block",
                                        marginTop: "16px",
                                        fontSize:
                                            "clamp(1.18rem, 4.3vw, 1.48rem)",
                                        fontWeight: 800,
                                        letterSpacing: "0.02em",
                                        lineHeight: 1.3,
                                        color: "#6d4a55",
                                    }}
                                >
                                    O detalhe que completa você
                                </span>
                            </div>

                            <div
                                style={{
                                    marginTop: "34px",
                                    paddingTop: "18px",
                                    textAlign: "center",
                                    color: "#000000",
                                    fontSize: "clamp(0.95rem, 3.2vw, 1.08rem)",
                                    fontWeight: 700,
                                    letterSpacing: "0.02em",
                                    lineHeight: 1.3,
                                }}
                            >
                                Desenvolvido por{" "}
                                <a
                                    href="https://www.instagram.com/msilva55048/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        color: "inherit",
                                        textDecoration: "none",
                                        fontWeight: "inherit",
                                    }}
                                >
                                    @msilva55048
                                </a>
                            </div>
                        </div>

                        <div className="hero__decoration hero__decoration--one"/>
                        <div className="hero__decoration hero__decoration--two"/>
                    </section>
                </>
            )}


            {showClientAuth && (
                <div className="client-modal-backdrop" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setShowClientAuth(false);
                }}>
                    <section className="client-modal">
                        <button className="client-modal__close" type="button" onClick={() => setShowClientAuth(false)}>×</button>
                        <span className="client-modal__eyebrow">Área da cliente</span>
                        <h2>{clientAuthMode === "login" ? "Entrar na sua conta" : "Criar sua conta"}</h2>
                        <p>
                            {clientAuthMode === "login"
                                ? "Acesse seus agendamentos usando seu e-mail e senha."
                                : "Crie sua conta para manter seus agendamentos vinculados ao seu perfil."}
                        </p>

                        <div className="client-auth-tabs">
                            <button
                                className={clientAuthMode === "login" ? "is-active" : ""}
                                type="button"
                                onClick={() => {
                                    setClientAuthMode("login");
                                    setShowAuthPassword(false);
                                    resetAuthMessages();
                                }}
                            >
                                Entrar
                            </button>
                            <button
                                className={clientAuthMode === "signup" ? "is-active" : ""}
                                type="button"
                                onClick={() => {
                                    setClientAuthMode("signup");
                                    setShowAuthPassword(false);
                                    resetAuthMessages();
                                }}
                            >
                                Criar conta
                            </button>
                        </div>

                        <form className="client-auth-form" onSubmit={submitClientAuth}>
                            {clientAuthMode === "signup" && (
                                <>
                                    <label>
                                        Nome completo
                                        <input
                                            value={authFullName}
                                            onChange={(event) => setAuthFullName(event.target.value)}
                                            autoComplete="name"
                                            maxLength={80}
                                            required
                                        />
                                    </label>
                                    <label>
                                        Telefone / WhatsApp
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            value={authPhone}
                                            onChange={(event) => setAuthPhone(formatBrazilianPhone(event.target.value))}
                                            placeholder="(00) 00000-0000"
                                            maxLength={15}
                                            autoComplete="tel"
                                            required
                                        />
                                    </label>
                                </>
                            )}

                            <label>
                                E-mail
                                <input
                                    type="email"
                                    value={authEmail}
                                    onChange={(event) => setAuthEmail(event.target.value)}
                                    autoComplete="email"
                                    required
                                />
                            </label>

                            <label>
                                Senha
                                <div className="client-password-field">
                                    <input
                                        type={showAuthPassword ? "text" : "password"}
                                        value={authPassword}
                                        onChange={(event) => setAuthPassword(event.target.value)}
                                        autoComplete={clientAuthMode === "login" ? "current-password" : "new-password"}
                                        minLength={6}
                                        required
                                    />
                                    <button
                                        className="client-password-toggle"
                                        type="button"
                                        onClick={() => setShowAuthPassword((current) => !current)}
                                        aria-label={showAuthPassword ? "Ocultar senha" : "Mostrar senha"}
                                    >
                                        {showAuthPassword ? "Ocultar" : "Mostrar"}
                                    </button>
                                </div>
                            </label>

                            {authError && <p className="client-auth-message is-error">{authError}</p>}
                            {authSuccess && <p className="client-auth-message is-success">{authSuccess}</p>}

                            <button className="client-auth-submit" type="submit" disabled={isSubmittingAuth}>
                                {isSubmittingAuth
                                    ? "Aguarde..."
                                    : clientAuthMode === "login"
                                        ? "Entrar"
                                        : "Criar minha conta"}
                            </button>
                        </form>
                    </section>
                </div>
            )}
            {showClientAccount && clientUserId && (
                <div className="client-modal-backdrop" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setShowClientAccount(false);
                }}>
                    <section className="client-modal client-modal--account">
                        <button className="client-modal__close" type="button" onClick={() => setShowClientAccount(false)}>×</button>
                        <span className="client-modal__eyebrow">Minha conta</span>
                        <h2>{clientProfile ? `Olá, ${clientProfile.full_name.split(/\s+/)[0]}!` : "Sua conta"}</h2>
                        <p>Consulte seus dados e os agendamentos vinculados ao seu perfil.</p>

                        {isLoadingClientAccount ? (
                            <div className="client-account__empty">Carregando sua conta...</div>
                        ) : clientProfile ? (
                            <>
                                <div className="client-account__profile">
                                    <div><span>Nome</span><strong>{clientProfile.full_name}</strong></div>
                                    <div><span>Telefone</span><strong>{formatBrazilianPhone(clientProfile.phone)}</strong></div>
                                    <div><span>E-mail</span><strong>{clientProfile.email || clientUserEmail}</strong></div>
                                </div>

                                <div className="client-account__actions">
                                    <button
                                        className="client-account__edit-profile"
                                        type="button"
                                        onClick={openClientProfileEditor}
                                    >
                                        <span className="client-account__edit-profile-icon">✎</span>
                                        <span>
                                            <strong>Editar perfil</strong>
                                            <small>Nome, telefone, e-mail e senha</small>
                                        </span>
                                        <span className="client-account__edit-profile-arrow">›</span>
                                    </button>

                                    <button
                                        className="client-account__logout"
                                        type="button"
                                        onClick={() => void logoutClient()}
                                    >
                                        Sair da conta
                                    </button>
                                </div>

                                <section className="client-account__section" id="client-account-appointments">
                                    <h3>Meus agendamentos</h3>
                                    {clientAppointments.length > 0 ? (
                                        <div className="client-account__appointments">
                                            {clientAppointments.map((appointment) => (
                                                <button
                                                    className={
                                                        isClientAppointmentEditable(appointment)
                                                            ? "client-account__appointment is-editable"
                                                            : "client-account__appointment"
                                                    }
                                                    key={appointment.id}
                                                    type="button"
                                                    disabled={!isClientAppointmentEditable(appointment)}
                                                    onClick={() => openEditClientAppointment(appointment)}
                                                >
                                                    <div>
                                                        <strong>{appointment.service_name}</strong>
                                                        <span>
                                                            {new Date(`${appointment.appointment_date}T12:00:00`).toLocaleDateString("pt-BR")}
                                                            {" às "}
                                                            {String(appointment.start_time).slice(0, 5)}
                                                        </span>
                                                        {isClientAppointmentEditable(appointment) && (
                                                            <span className="client-account__appointment-hint">
                                                                Toque para alterar dia, horário ou cancelar
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="client-account__status">
                                                        {getClientAppointmentStatusLabel(appointment.status)}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="client-account__empty">
                                            Você ainda não possui agendamentos vinculados a esta conta.
                                        </div>
                                    )}
                                </section>
                            </>
                        ) : (
                            <div className="client-account__empty">
                                Sua conta está autenticada, mas o perfil ainda não foi vinculado. Saia e entre novamente; se continuar, fale com a Mirian.
                            </div>
                        )}
                    </section>
                </div>
            )}

            {showClientProfileEditor && clientProfile && (
                <div
                    className="client-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeClientProfileEditor();
                        }
                    }}
                >
                    <section className="client-modal client-profile-editor">
                        <button
                            className="client-modal__close"
                            type="button"
                            onClick={closeClientProfileEditor}
                            aria-label="Fechar edição do perfil"
                        >
                            ×
                        </button>

                        <span className="client-modal__eyebrow">Meu perfil</span>
                        <h2>Editar perfil</h2>
                        <p>
                            Atualize seus dados. As alterações são feitas no mesmo
                            cadastro já vinculado à sua conta.
                        </p>

                        <form
                            className="client-profile-editor__form"
                            onSubmit={saveClientProfileChanges}
                        >
                            <label>
                                Nome completo
                                <input
                                    value={profileEditName}
                                    onChange={(event) =>
                                        setProfileEditName(event.target.value)
                                    }
                                    autoComplete="name"
                                    maxLength={80}
                                    required
                                />
                            </label>

                            <label>
                                Telefone / WhatsApp
                                <input
                                    type="tel"
                                    inputMode="numeric"
                                    value={profileEditPhone}
                                    onChange={(event) =>
                                        setProfileEditPhone(
                                            formatBrazilianPhone(
                                                event.target.value,
                                            ),
                                        )
                                    }
                                    placeholder="(00) 00000-0000"
                                    maxLength={15}
                                    autoComplete="tel"
                                    required
                                />
                            </label>

                            <label>
                                E-mail
                                <input
                                    type="email"
                                    value={profileEditEmail}
                                    onChange={(event) =>
                                        setProfileEditEmail(event.target.value)
                                    }
                                    autoComplete="email"
                                    required
                                />
                            </label>

                            <label>
                                Nova senha
                                <small className="client-profile-editor__hint">
                                    Deixe em branco para manter a senha atual.
                                </small>

                                <div className="client-password-field">
                                    <input
                                        type={
                                            showProfileEditPassword
                                                ? "text"
                                                : "password"
                                        }
                                        value={profileEditPassword}
                                        onChange={(event) =>
                                            setProfileEditPassword(
                                                event.target.value,
                                            )
                                        }
                                        autoComplete="new-password"
                                        minLength={6}
                                        placeholder="Nova senha"
                                    />

                                    <button
                                        className="client-password-toggle"
                                        type="button"
                                        onClick={() =>
                                            setShowProfileEditPassword(
                                                (current) => !current,
                                            )
                                        }
                                    >
                                        {showProfileEditPassword
                                            ? "Ocultar"
                                            : "Mostrar"}
                                    </button>
                                </div>
                            </label>

                            <label>
                                Confirmar nova senha
                                <input
                                    type={
                                        showProfileEditPassword
                                            ? "text"
                                            : "password"
                                    }
                                    value={profileEditPasswordConfirm}
                                    onChange={(event) =>
                                        setProfileEditPasswordConfirm(
                                            event.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                    minLength={6}
                                    placeholder="Repita a nova senha"
                                />
                            </label>

                            {profileEditError && (
                                <p className="client-auth-message is-error">
                                    {profileEditError}
                                </p>
                            )}

                            {profileEditSuccess && (
                                <p className="client-auth-message is-success">
                                    {profileEditSuccess}
                                </p>
                            )}

                            <div className="client-profile-editor__actions">
                                <button
                                    type="submit"
                                    className="client-profile-editor__save"
                                    disabled={isSavingProfileEdit}
                                >
                                    {isSavingProfileEdit
                                        ? "Salvando..."
                                        : "Salvar alterações"}
                                </button>

                                <button
                                    type="button"
                                    className="client-profile-editor__cancel"
                                    onClick={closeClientProfileEditor}
                                    disabled={isSavingProfileEdit}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </main>
    );
}


type AdminAppointment = {
    id: string;
    client_id?: string | null;
    client_name: string;
    client_phone: string;
    client_email: string | null;
    musical_taste: string | null;
    service_name: string;
    appointment_date: string;
    start_time: string;
    duration_minutes: number;
    price_cents: number | null;
    client_hidden: boolean;
    status: "pending" | "confirmed" | "completed" | "cancelled" | "no-show";
    created_at: string;
};

type AdminScheduleBlock = {
    id: string;
    block_date: string;
    start_time: string;
    end_time: string;
    reason: string | null;
    created_at: string;
};

type AdminServiceSetting = {
    id: number;
    name: string;
    description: string;
    duration_minutes: number;
    price_cents: number;
    display_order: number;
};


type AdminClient = {
    key: string;
    name: string;
    phone: string;
    email: string;
    musicalTaste: string;
    appointments: AdminAppointment[];
    lastAppointment: AdminAppointment | null;
    nextAppointment: AdminAppointment | null;
};

type ClientAnamnesisForm = {
    birthDate: string;
    referral: string;
    pregnant: string;
    diabetes: string;
    bariatric: string;
    chemotherapy: string;
    thyroid: string;
    nailBiting: string;
    allergies: string;
    mycosis: string;
    continuousMedication: string;
    cleaningProducts: string;
};

const emptyClientAnamnesis: ClientAnamnesisForm = {
    birthDate: "",
    referral: "",
    pregnant: "",
    diabetes: "",
    bariatric: "",
    chemotherapy: "",
    thyroid: "",
    nailBiting: "",
    allergies: "",
    mycosis: "",
    continuousMedication: "",
    cleaningProducts: "",
};

type ClientProfile = {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    musical_taste?: string | null;
    phone_digits?: string;
    user_id?: string | null;
    created_at?: string;
    updated_at?: string;
};

type AdminBookingClient = {
    key: string;
    profileId: string | null;
    name: string;
    phone: string;
    email: string;
    userId?: string | null;
};

type NailRecordPhoto = {
    id: string;
    nail_record_id: string;
    photo_path: string;
    created_at: string;
    signedUrl?: string;
};

type NailRecord = {
    id: string;
    client_id: string;
    notes: string | null;
    created_at: string;
    photos: NailRecordPhoto[];
};


const adminStyles = `
.admin-page {
    min-height: 100vh;
    background:
        radial-gradient(circle at top left, rgba(216, 172, 184, 0.22), transparent 32rem),
        #f8f4f5;
    color: #251c1f;
    font-family: Arial, sans-serif;
}

.admin-login {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
}

.admin-login__card {
    width: min(100%, 430px);
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid rgba(125, 78, 91, 0.14);
    border-radius: 24px;
    padding: 34px;
    box-shadow: 0 24px 70px rgba(83, 48, 58, 0.16);
}

.admin-login__brand {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 28px;
}

.admin-login__logo {
    width: 54px;
    height: 54px;
    display: block;
    object-fit: contain;
    flex: 0 0 54px;
}

.admin-login__brand strong,
.admin-login__brand span {
    display: block;
}

.admin-login__brand span {
    margin-top: 4px;
    color: #80666e;
    font-size: 0.88rem;
}

.admin-login h1 {
    margin: 0 0 8px;
    font-size: 1.75rem;
}

.admin-login > .admin-login__card > p {
    margin: 0 0 24px;
    color: #765f66;
    line-height: 1.5;
}

.admin-field {
    display: grid;
    gap: 8px;
    margin-bottom: 17px;
}

.admin-field label {
    font-weight: 700;
    font-size: 0.92rem;
}

.admin-field input,
.admin-toolbar input,
.admin-toolbar select {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #d8c7cc;
    border-radius: 12px;
    background: #fff;
    padding: 13px 14px;
    font: inherit;
    color: #251c1f;
}

.admin-field input:focus,
.admin-toolbar input:focus,
.admin-toolbar select:focus {
    outline: 2px solid rgba(184, 120, 139, 0.26);
    border-color: #a96679;
}

.admin-primary-button,
.admin-secondary-button,
.admin-action {
    border: 0;
    border-radius: 12px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.16s ease, opacity 0.16s ease;
}

.admin-primary-button:hover,
.admin-secondary-button:hover,
.admin-action:hover {
    transform: translateY(-2px);
}

.admin-primary-button {
    width: 100%;
    padding: 14px 18px;
    background: linear-gradient(135deg, #a86175, #6d3445);
    color: white;
}

.admin-primary-button:disabled,
.admin-action:disabled {
    opacity: 0.6;
    cursor: wait;
}

.admin-login__error,
.admin-panel__error {
    border-radius: 12px;
    padding: 12px 14px;
    background: #fff0f1;
    color: #a02f3d;
    margin: 0 0 16px;
}

.admin-panel {
    width: min(1240px, calc(100% - 32px));
    margin: 0 auto;
    padding: 24px 0 64px;
}

.admin-header {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    margin-bottom: 22px;
    padding: 16px 18px;
    border: 1px solid rgba(125, 78, 91, 0.12);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 10px 30px rgba(83, 48, 58, 0.08);
    backdrop-filter: blur(12px);
}

.admin-header h1 {
    margin: 0;
    font-size: clamp(1.55rem, 3vw, 2.35rem);
}

.admin-header p {
    margin: 6px 0 0;
    color: #765f66;
}

.admin-secondary-button {
    padding: 11px 16px;
    background: #fff;
    color: #6d3445;
    border: 1px solid #d7c0c7;
}

.admin-toolbar {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) 210px 180px;
    gap: 12px;
    padding: 14px;
    margin-bottom: 16px;
    background: rgba(255, 255, 255, 0.94);
    border: 1px solid rgba(125, 78, 91, 0.12);
    border-radius: 16px;
    box-shadow: 0 8px 24px rgba(83, 48, 58, 0.05);
}

.admin-list {
    display: grid;
    gap: 14px;
}

.admin-appointment {
    background: white;
    border: 1px solid rgba(125, 78, 91, 0.13);
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 12px 35px rgba(83, 48, 58, 0.06);
}

.admin-appointment__top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;
}

.admin-appointment__time {
    color: #9a5368;
    font-weight: 800;
    font-size: 1.15rem;
}

.admin-appointment h2 {
    margin: 5px 0 0;
    font-size: 1.18rem;
}

.admin-status {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 7px 11px;
    font-size: 0.78rem;
    font-weight: 800;
}

.admin-status--pending {
    background: #fff4d9;
    color: #8a6100;
}

.admin-status--confirmed {
    background: #e7f7ed;
    color: #1d7540;
}

.admin-status--completed {
    background: #e7eefb;
    color: #315a9b;
}

.admin-status--cancelled {
    background: #f8e7ea;
    color: #9b3646;
}

.admin-appointment__details {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    padding-top: 15px;
    border-top: 1px solid #eee4e7;
}

.admin-detail span {
    display: block;
    color: #80666e;
    font-size: 0.78rem;
    margin-bottom: 5px;
}

.admin-detail strong,
.admin-detail a {
    color: #312428;
    text-decoration: none;
    overflow-wrap: anywhere;
}

.admin-appointment__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 18px;
}

.admin-action {
    padding: 10px 13px;
}

.admin-action--confirm {
    background: #287c4a;
    color: white;
}

.admin-action--cancel {
    background: #a23f4d;
    color: white;
}

.admin-action--whatsapp {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    border-radius: 12px;
    padding: 10px 13px;
    background: #1f9d59;
    color: white;
    font-weight: 700;
}

.admin-empty,
.admin-loading {
    padding: 34px 20px;
    text-align: center;
    background: white;
    border-radius: 18px;
    color: #765f66;
}


.admin-date-navigation button,
.admin-view-switch button,
.admin-new-appointment__toggle,
.admin-block-form button,
.admin-manual-form__save,
.admin-manual-form__cancel {
    transition:
        transform 0.16s ease,
        box-shadow 0.16s ease,
        background-color 0.16s ease;
}

.admin-date-navigation button:hover,
.admin-view-switch button:hover,
.admin-new-appointment__toggle:hover,
.admin-block-form button:hover,
.admin-manual-form__save:hover,
.admin-manual-form__cancel:hover {
    transform: translateY(-1px);
}

.admin-new-appointment,
.admin-block-manager {
    border-radius: 20px;
    box-shadow: 0 12px 34px rgba(83, 48, 58, 0.07);
}


.admin-clients {
    padding: 22px;
    border: 1px solid rgba(125, 78, 91, 0.12);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 14px 38px rgba(83, 48, 58, 0.07);
}

.admin-clients__header {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    align-items: flex-start;
    margin-bottom: 20px;
}

.admin-clients__eyebrow {
    display: block;
    margin-bottom: 6px;
    color: #9a5368;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.admin-clients__header h2,
.admin-client-history h2,
.admin-client-editor h2 {
    margin: 0;
    color: #35272c;
}

.admin-clients__header p,
.admin-client-history > p {
    margin: 7px 0 0;
    color: #755961;
}

.admin-clients__count {
    min-width: 150px;
    padding: 13px 15px;
    border-radius: 16px;
    background: #f6e9ed;
    text-align: center;
}

.admin-clients__count strong,
.admin-clients__count span {
    display: block;
}

.admin-clients__count strong {
    color: #6d3445;
    font-size: 1.45rem;
}

.admin-clients__count span {
    margin-top: 3px;
    color: #755961;
    font-size: 0.75rem;
}

.admin-clients__search {
    margin-bottom: 20px;
}

.admin-clients__search label,
.admin-client-editor label {
    display: grid;
    gap: 7px;
    color: #5f454d;
    font-size: 0.82rem;
    font-weight: 800;
}

.admin-clients__search input,
.admin-client-editor input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #dbc5cc;
    border-radius: 12px;
    padding: 11px 12px;
    background: #fff;
    color: #35272c;
    font: inherit;
}

.admin-clients__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 15px;
}

.admin-client-card {
    padding: 17px;
    border: 1px solid rgba(125, 78, 91, 0.13);
    border-radius: 18px;
    background: #fff;
    box-shadow: 0 8px 24px rgba(83, 48, 58, 0.05);
}

.admin-client-card__top {
    display: flex;
    gap: 12px;
    align-items: center;
}

.admin-client-card__avatar {
    width: 46px;
    height: 46px;
    flex: 0 0 46px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: linear-gradient(135deg, #6d3445, #aa667a);
    color: #fff;
    font-weight: 900;
}

.admin-client-card__top h3 {
    margin: 0 0 4px;
    color: #35272c;
}

.admin-client-card__top a,
.admin-client-card__top span {
    display: block;
    color: #755961;
    font-size: 0.79rem;
    text-decoration: none;
}

.admin-client-card__metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin: 16px 0 12px;
}

.admin-client-card__metrics div,
.admin-client-card__next {
    padding: 11px;
    border-radius: 12px;
    background: #faf5f7;
}

.admin-client-card__metrics span,
.admin-client-card__next span {
    display: block;
    color: #8a7078;
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
}

.admin-client-card__metrics strong,
.admin-client-card__next strong {
    display: block;
    margin-top: 4px;
    color: #4d363e;
    font-size: 0.84rem;
}

.admin-client-card__next {
    margin-bottom: 12px;
    background: #f3e4e9;
}

.admin-client-card__actions {
    display: flex;
    gap: 8px;
}

.admin-client-card__actions button {
    flex: 1;
    border: 0;
    border-radius: 10px;
    padding: 10px;
    background: #6d3445;
    color: #fff;
    font: inherit;
    font-size: 0.76rem;
    font-weight: 900;
    cursor: pointer;
}

.admin-client-card__actions button.is-secondary {
    background: #eadde1;
    color: #6d3445;
}

.admin-client-card__actions button.is-nail-record {
    background: #9a5368;
    color: #fff;
}

.admin-client-history,
.admin-client-editor {
    position: relative;
    width: min(100%, 650px);
    max-height: calc(100vh - 40px);
    overflow: auto;
    box-sizing: border-box;
    padding: 24px;
    border-radius: 22px;
    background: #fff;
    box-shadow: 0 22px 60px rgba(45, 25, 31, 0.22);
}

.admin-client-editor {
    width: min(100%, 470px);
    display: grid;
    gap: 15px;
}

.admin-client-history__list {
    display: grid;
    gap: 9px;
    margin-top: 20px;
}

.admin-client-history__list article {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    padding: 13px;
    border: 1px solid rgba(125, 78, 91, 0.12);
    border-radius: 13px;
    background: #faf6f7;
}

.admin-client-history__list article.is-cancelled-cleanable {
    cursor: pointer;
    border-color: rgba(162, 63, 77, .24);
    background: #fff7f8;
    transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
}

.admin-client-history__list article.is-cancelled-cleanable:hover {
    transform: translateY(-1px);
    border-color: rgba(162, 63, 77, .42);
    box-shadow: 0 8px 20px rgba(83, 48, 58, .08);
}

.admin-client-history__list article.is-cancelled-cleanable:focus-visible {
    outline: 3px solid rgba(154, 83, 104, .2);
    outline-offset: 2px;
}

.admin-client-history__cancelled-action {
    display: grid;
    gap: 3px;
    text-align: right;
}

.admin-client-history__cancelled-action strong {
    color: #a23f4d;
    font-size: .78rem;
}

.admin-client-history__cancelled-action small {
    color: #9a7079;
    font-size: .68rem;
}

.admin-client-history__list article.is-clearing {
    opacity: .55;
    pointer-events: none;
}

.admin-client-history__list strong,
.admin-client-history__list span {
    display: block;
}

.admin-client-history__list div > span {
    margin-top: 3px;
    color: #755961;
    font-size: 0.78rem;
}

@media (max-width: 800px) {
    .admin-clients__grid {
        grid-template-columns: 1fr;
    }

    .admin-clients__header {
        flex-direction: column;
    }

    .admin-clients__count {
        width: 100%;
        box-sizing: border-box;
    }

    .admin-client-card__actions {
        flex-direction: column;
    }
}

@media (max-width: 800px) {
    .admin-summary {
        grid-template-columns: 1fr;
    }

    .admin-toolbar {
        grid-template-columns: 1fr;
    }

    .admin-appointment__details {
        grid-template-columns: 1fr 1fr;
    }
}


.admin-view-controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;
    padding: 12px 14px;
    border: 1px solid rgba(125, 78, 91, 0.12);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.88);
}

.admin-view-switch {
    display: inline-flex;
    gap: 5px;
    padding: 5px;
    border-radius: 14px;
    background: #efe3e7;
    box-shadow: inset 0 0 0 1px rgba(109, 52, 69, 0.05);
}

.admin-view-switch button {
    border: 0;
    border-radius: 10px;
    padding: 10px 16px;
    background: transparent;
    color: #71545d;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
}

.admin-view-switch button.is-active {
    background: #fff;
    color: #6d3445;
    box-shadow: 0 5px 16px rgba(83, 48, 58, 0.1);
}

.admin-date-navigation {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}

.admin-date-navigation button {
    border: 1px solid #d7c0c7;
    border-radius: 11px;
    padding: 9px 12px;
    background: #fff;
    color: #6d3445;
    font: inherit;
    font-weight: 750;
    cursor: pointer;
}

.admin-selected-date {
    min-width: 225px;
    text-align: center;
    font-weight: 800;
    color: #4a343b;
    text-transform: capitalize;
}

.admin-agenda {
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr);
    overflow: hidden;
    background: #fff;
    border: 1px solid rgba(125, 78, 91, 0.13);
    border-radius: 22px;
    box-shadow: 0 16px 42px rgba(83, 48, 58, 0.08);
}

.admin-agenda__hours {
    border-right: 1px solid #eadfe2;
    background: #fbf8f9;
}

.admin-agenda__hour-label {
    height: 76px;
    box-sizing: border-box;
    padding: 10px 12px 0 0;
    text-align: right;
    color: #8a7078;
    font-size: 0.8rem;
    border-bottom: 1px solid #f0e8ea;
}

.admin-agenda__canvas {
    position: relative;
    min-height: 1064px;
    background:
        repeating-linear-gradient(
            to bottom,
            transparent 0,
            transparent 75px,
            #f0e8ea 75px,
            #f0e8ea 76px
        );
}

.admin-agenda__appointment {
    transition:
        background-color 0.18s ease,
        border-color 0.18s ease,
        box-shadow 0.18s ease,
        transform 0.18s ease;
}

.admin-agenda__appointment {
    position: absolute;
    left: 12px;
    right: 12px;
    z-index: 2;
    overflow: auto;
    box-sizing: border-box;
    min-height: 48px;
    padding: 12px 14px;
    border: 1px solid #cfaab5;
    border-left: 5px solid #9a5368;
    border-radius: 14px;
    background: linear-gradient(135deg, #fff9fb, #f6e9ed);
    box-shadow: 0 8px 22px rgba(91, 50, 62, 0.11);
}

.admin-agenda__appointment.is-next {
    border-color: #d8aab6;
    border-left-color: #9f5065;
    background: #fff8fa;
    box-shadow: 0 8px 22px rgba(111, 48, 66, 0.14);
}

.admin-agenda__appointment.is-past {
    border-color: #ddd3d6;
    border-left-color: #aaa0a4;
    background: #f7f4f5;
    box-shadow: none;
    opacity: 0.68;
}

.admin-agenda__appointment.is-cancelled {
    border-color: #decbd0;
    border-left-color: #a9a0a3;
    background: #f4f1f2;
    opacity: 0.72;
}

.admin-agenda__appointment strong {
    display: block;
    color: #35272c;
    font-size: 1rem;
    line-height: 1.35;
}

.admin-agenda__appointment span {
    display: block;
    margin-top: 5px;
    color: #755961;
    font-size: 0.8rem;
    line-height: 1.35;
}

.admin-agenda__appointment span:first-of-type {
    font-weight: 700;
    color: #624850;
}

.admin-agenda__appointment span:nth-of-type(2) {
    color: #8a7078;
    font-size: 0.76rem;
}

.admin-agenda__appointment-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 7px;
    margin-top: 11px;
}

.admin-agenda__appointment-actions button,
.admin-agenda__appointment-actions a {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 8px;
    padding: 7px 10px;
    font: inherit;
    font-size: 0.75rem;
    font-weight: 800;
    line-height: 1;
    cursor: pointer;
    text-decoration: none;
}

.admin-agenda__appointment-actions button:focus-visible,
.admin-agenda__appointment-actions a:focus-visible {
    outline: 3px solid rgba(154, 83, 104, 0.28);
    outline-offset: 2px;
}

.admin-agenda__appointment-actions button {
    background: #a23f4d;
    color: #fff;
}

.admin-agenda__appointment-actions a {
    background: #1f9d59;
    color: #fff;
}

.admin-agenda__empty {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 30px;
    color: #80666e;
    text-align: center;
}

.admin-next-appointment {
    position: relative;
    overflow: hidden;
    margin-bottom: 18px;
    padding: 20px 22px;
    border: 1px solid rgba(154, 83, 104, 0.2);
    border-radius: 20px;
    background: linear-gradient(135deg, #633042, #aa667a);
    color: #fff;
    box-shadow: 0 14px 38px rgba(83, 48, 58, 0.16);
}

.admin-next-appointment::after {
    content: "";
    position: absolute;
    width: 150px;
    height: 150px;
    right: -55px;
    top: -70px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
}

.admin-next-appointment span {
    display: block;
    margin-bottom: 7px;
    font-size: 0.82rem;
    opacity: 0.84;
}

.admin-next-appointment strong {
    display: block;
    font-size: 1.08rem;
}

.admin-next-appointment small {
    display: block;
    margin-top: 5px;
    opacity: 0.9;
}


.admin-details-button {
    border: 0;
    border-radius: 8px;
    padding: 7px 9px;
    background: #6d3445;
    color: #fff;
    font: inherit;
    font-size: 0.75rem;
    font-weight: 800;
    cursor: pointer;
}

.admin-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    padding: 18px;
    background: rgba(35, 21, 26, 0.62);
    backdrop-filter: blur(4px);
}

.admin-modal {
    width: min(100%, 620px);
    max-height: calc(100vh - 36px);
    overflow: auto;
    border-radius: 22px;
    background: #fff;
    box-shadow: 0 28px 80px rgba(35, 21, 26, 0.3);
}

.admin-modal__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding: 22px 22px 16px;
    border-bottom: 1px solid #eee4e7;
}

.admin-modal__header h2 {
    margin: 0;
    font-size: 1.35rem;
}

.admin-modal__header p {
    margin: 6px 0 0;
    color: #80666e;
}

.admin-modal__close {
    width: 38px;
    height: 38px;
    flex: 0 0 auto;
    border: 0;
    border-radius: 50%;
    background: #f2e8eb;
    color: #6d3445;
    font-size: 1.2rem;
    cursor: pointer;
}

.admin-modal__body {
    padding: 20px 22px 24px;
}

.admin-modal__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 22px;
}

.admin-modal__item {
    padding: 14px;
    border-radius: 14px;
    background: #faf6f7;
}

.admin-modal__item span {
    display: block;
    margin-bottom: 5px;
    color: #80666e;
    font-size: 0.78rem;
}

.admin-modal__item strong,
.admin-modal__item a {
    color: #312428;
    text-decoration: none;
    overflow-wrap: anywhere;
}

.admin-reschedule {
    padding-top: 20px;
    border-top: 1px solid #eee4e7;
}

.admin-reschedule h3 {
    margin: 0 0 6px;
}

.admin-reschedule > p {
    margin: 0 0 16px;
    color: #80666e;
    font-size: 0.9rem;
}

.admin-reschedule__fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.admin-reschedule__fields label {
    display: grid;
    gap: 7px;
    font-weight: 750;
    font-size: 0.88rem;
}

.admin-reschedule__fields input,
.admin-reschedule__fields select {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #d8c7cc;
    border-radius: 11px;
    padding: 12px;
    background: #fff;
    color: #312428;
    font: inherit;
}

.admin-reschedule__message {
    margin: 13px 0 0;
    padding: 11px 12px;
    border-radius: 11px;
    background: #fff0f1;
    color: #a02f3d;
    font-size: 0.88rem;
}

.admin-reschedule__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 16px;
}

.admin-reschedule__save {
    border: 0;
    border-radius: 11px;
    padding: 11px 15px;
    background: #6d3445;
    color: #fff;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
}

.admin-reschedule__save:disabled {
    opacity: 0.6;
    cursor: wait;
}

.admin-modal__whatsapp {
    display: inline-flex;
    margin-top: 16px;
    border-radius: 11px;
    padding: 11px 14px;
    background: #1f9d59;
    color: #fff;
    text-decoration: none;
    font-weight: 800;
}

@media (max-width: 560px) {
    .admin-modal__grid,
    .admin-reschedule__fields {
        grid-template-columns: 1fr;
    }

    .admin-modal__header,
    .admin-modal__body {
        padding-left: 17px;
        padding-right: 17px;
    }
}


.admin-block-manager {
    margin-bottom: 18px;
    padding: 18px;
    border: 1px solid rgba(125, 78, 91, 0.13);
    border-radius: 18px;
    background: #fff;
    box-shadow: 0 12px 35px rgba(83, 48, 58, 0.06);
}

.admin-block-manager__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
}

.admin-block-manager__header h2 {
    margin: 0;
    font-size: 1.08rem;
}

.admin-block-manager__header p {
    margin: 5px 0 0;
    color: #80666e;
    font-size: 0.88rem;
}

.admin-block-form {
    display: grid;
    grid-template-columns: 1.2fr 1fr 1fr 1.6fr auto;
    gap: 10px;
    align-items: end;
}

.admin-block-form label {
    display: grid;
    gap: 7px;
    font-weight: 750;
    font-size: 0.84rem;
}

.admin-block-form input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #d8c7cc;
    border-radius: 11px;
    padding: 11px 12px;
    font: inherit;
}

.admin-block-form button {
    border: 0;
    border-radius: 11px;
    padding: 11px 14px;
    background: #6d3445;
    color: #fff;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
}

.admin-block-form button:disabled {
    opacity: 0.6;
    cursor: wait;
}

.admin-block-list {
    display: grid;
    gap: 9px;
    margin-top: 14px;
}

.admin-block-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 12px 13px;
    border-radius: 12px;
    background: #f8f1f3;
}

.admin-block-item strong,
.admin-block-item span {
    display: block;
}

.admin-block-item span {
    margin-top: 3px;
    color: #80666e;
    font-size: 0.82rem;
}

.admin-block-item button {
    border: 0;
    border-radius: 9px;
    padding: 8px 10px;
    background: #a23f4d;
    color: #fff;
    font: inherit;
    font-size: 0.8rem;
    font-weight: 800;
    cursor: pointer;
}

.admin-agenda__block {
    position: absolute;
    left: 12px;
    right: 12px;
    z-index: 1;
    box-sizing: border-box;
    min-height: 46px;
    padding: 10px 12px;
    border: 1px dashed #95858a;
    border-left: 5px solid #6b6265;
    border-radius: 12px;
    background:
        repeating-linear-gradient(
            -45deg,
            #ece8e9,
            #ece8e9 9px,
            #f5f2f3 9px,
            #f5f2f3 18px
        );
    color: #51484b;
    overflow: hidden;
}

.admin-agenda__block strong {
    display: block;
    font-size: 0.9rem;
}

.admin-agenda__block span {
    display: block;
    margin-top: 4px;
    font-size: 0.78rem;
}

.admin-block-error {
    margin: 12px 0 0;
    padding: 11px 12px;
    border-radius: 11px;
    background: #fff0f1;
    color: #a02f3d;
    font-size: 0.88rem;
}

@media (max-width: 950px) {
    .admin-block-form {
        grid-template-columns: 1fr 1fr;
    }

    .admin-block-form button {
        grid-column: 1 / -1;
    }
}

@media (max-width: 560px) {
    .admin-block-form {
        grid-template-columns: 1fr;
    }

    .admin-block-item {
        align-items: flex-start;
        flex-direction: column;
    }
}


.admin-new-appointment {
    margin-bottom: 18px;
    padding: 18px;
    border: 1px solid rgba(125, 78, 91, 0.13);
    border-radius: 18px;
    background: #fff;
    box-shadow: 0 12px 35px rgba(83, 48, 58, 0.06);
}

.admin-new-appointment__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
}

.admin-new-appointment__header h2 {
    margin: 0;
    font-size: 1.08rem;
}

.admin-new-appointment__header p {
    margin: 5px 0 0;
    color: #80666e;
    font-size: 0.88rem;
}

.admin-new-appointment__toggle {
    border: 0;
    border-radius: 11px;
    padding: 10px 14px;
    background: #6d3445;
    color: #fff;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
}

.admin-manual-form {
    display: grid;
    grid-template-columns: 1.2fr 1fr 1.3fr 1fr 1fr;
    gap: 11px;
    align-items: end;
}

.admin-manual-form label {
    display: grid;
    gap: 7px;
    font-weight: 750;
    font-size: 0.84rem;
}

.admin-manual-form input,
.admin-manual-form select {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #d8c7cc;
    border-radius: 11px;
    padding: 11px 12px;
    background: #fff;
    color: #312428;
    font: inherit;
}


.admin-manual-form__actions {
    display: flex;
    gap: 10px;
    align-items: center;
}

.admin-manual-form__save {
    border: 0;
    border-radius: 11px;
    padding: 11px 15px;
    background: #6d3445;
    color: #fff;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
}

.admin-manual-form__save:disabled {
    opacity: 0.6;
    cursor: wait;
}

.admin-manual-form__cancel {
    border: 1px solid #d8c7cc;
    border-radius: 11px;
    padding: 10px 14px;
    background: #fff;
    color: #6d3445;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
}

.admin-manual-form__error,
.admin-manual-form__success {
    grid-column: 1 / -1;
    margin: 0;
    padding: 11px 12px;
    border-radius: 11px;
    font-size: 0.88rem;
}

.admin-manual-form__error {
    background: #fff0f1;
    color: #a02f3d;
}

.admin-manual-form__success {
    background: #eef9f2;
    color: #247145;
}

@media (max-width: 1050px) {
    .admin-manual-form {
        grid-template-columns: 1fr 1fr;
    }

    .admin-manual-form__actions {
        grid-column: 1 / -1;
    }
}

@media (max-width: 620px) {
    .admin-new-appointment__header {
        align-items: stretch;
        flex-direction: column;
    }

    .admin-manual-form {
        grid-template-columns: 1fr;
    }

    .admin-manual-form__actions {
        grid-column: auto;
        flex-direction: column;
        align-items: stretch;
    }
}


.admin-week {
    overflow-x: auto;
    padding-bottom: 8px;
}

.admin-week__grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(210px, 1fr));
    gap: 12px;
    min-width: 1510px;
}

.admin-week__day {
    min-height: 430px;
    border: 1px solid rgba(125, 78, 91, 0.14);
    border-radius: 18px;
    background: #fff;
    overflow: hidden;
    box-shadow: 0 10px 28px rgba(83, 48, 58, 0.05);
    transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.admin-week__day:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 34px rgba(83, 48, 58, 0.08);
}

.admin-week__day.is-today {
    border-color: #6d3445;
    box-shadow: 0 0 0 2px rgba(109, 52, 69, 0.12);
}

.admin-week__day.is-today .admin-week__day-header {
    background: linear-gradient(135deg, #6d3445, #9a5368);
}

.admin-week__day.is-today .admin-week__day-header span,
.admin-week__day.is-today .admin-week__day-header strong {
    color: #fff;
}

.admin-week__day-header {
    padding: 14px;
    border-bottom: 1px solid #eee4e7;
    background: #faf6f7;
}

.admin-week__day-header span,
.admin-week__day-header strong {
    display: block;
}

.admin-week__day-header span {
    color: #80666e;
    font-size: 0.78rem;
    font-weight: 800;
    text-transform: uppercase;
}

.admin-week__day-header strong {
    margin-top: 4px;
    color: #312428;
    font-size: 1.05rem;
}

.admin-week__content {
    display: grid;
    gap: 9px;
    padding: 11px;
}

.admin-week__appointment,
.admin-week__block {
    padding: 11px;
    border-radius: 12px;
}

.admin-week__appointment {
    border-left: 4px solid #6d3445;
    background: #f8eef1;
}

.admin-week__appointment.is-cancelled {
    border-left-color: #a79a9e;
    background: #f2eff0;
    opacity: 0.72;
}

.admin-week__block {
    border-left: 4px solid #6b6265;
    background:
        repeating-linear-gradient(
            -45deg,
            #ece8e9,
            #ece8e9 8px,
            #f5f2f3 8px,
            #f5f2f3 16px
        );
}

.admin-week__appointment strong,
.admin-week__block strong {
    display: block;
    color: #312428;
    font-size: 0.88rem;
}

.admin-week__appointment span,
.admin-week__block span {
    display: block;
    margin-top: 4px;
    color: #6f5c62;
    font-size: 0.76rem;
    line-height: 1.35;
}

.admin-week__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 9px;
}

.admin-week__actions button,
.admin-week__actions a {
    border: 0;
    border-radius: 8px;
    padding: 7px 8px;
    font: inherit;
    font-size: 0.72rem;
    font-weight: 800;
    cursor: pointer;
    text-decoration: none;
}

.admin-week__actions button {
    background: #6d3445;
    color: #fff;
}

.admin-week__actions a {
    background: #1f9d59;
    color: #fff;
}

.admin-week__empty {
    padding: 22px 10px;
    color: #9a858c;
    text-align: center;
    font-size: 0.82rem;
}

@media (max-width: 720px) {
    .admin-view-controls,
    .admin-date-navigation {
        align-items: stretch;
    }

    .admin-view-controls {
        flex-direction: column;
    }

    .admin-view-switch {
        display: grid;
        grid-template-columns: 1fr 1fr;
    }

    .admin-date-navigation {
        display: grid;
        grid-template-columns: auto 1fr auto;
    }

    .admin-date-navigation .admin-today-button {
        grid-column: 1 / -1;
    }

    .admin-selected-date {
        min-width: 0;
        align-self: center;
    }

    .admin-agenda {
        grid-template-columns: 58px minmax(0, 1fr);
    }

    .admin-agenda__hour-label {
        padding-right: 7px;
    }

    .admin-agenda__appointment {
        left: 7px;
        right: 7px;
        padding: 9px;
    }
}

@media (max-width: 520px) {
    .admin-panel {
        width: min(100% - 20px, 1180px);
        padding-top: 16px;
    }

    .admin-header {
        align-items: flex-start;
    }

    .admin-login__card {
        padding: 25px 20px;
    }

    .admin-appointment__details {
        grid-template-columns: 1fr;
    }

    .admin-appointment__top {
        flex-direction: column;
    }
}
`;

function formatAdminDate(date: string) {
    return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function normalizePhoneForWhatsApp(phone: string) {
    const digits = phone.replace(/\D/g, "");

    if (digits.startsWith("55")) {
        return digits;
    }

    return `55${digits}`;
}

function addDaysToInputDate(date: string, amount: number) {
    const value = new Date(`${date}T12:00:00`);
    value.setDate(value.getDate() + amount);
    return formatDateForInput(value);
}

function getMinutesFromTime(time: string) {
    const [hours, minutes] = String(time).slice(0, 5).split(":").map(Number);
    return hours * 60 + minutes;
}

function getAppointmentDateTime(appointment: AdminAppointment) {
    return new Date(
        `${appointment.appointment_date}T${String(appointment.start_time).slice(0, 5)}:00`,
    );
}

function getAppointmentEndDateTime(appointment: AdminAppointment) {
    const start = getAppointmentDateTime(appointment);

    return new Date(
        start.getTime() + appointment.duration_minutes * 60_000,
    );
}


type WhatsAppNotificationType = "attendance-confirmation" | "two-hour-reminder";

function formatAppointmentDateForMessage(date: string) {
    return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function buildWhatsAppMessage(
    appointment: AdminAppointment,
    type: WhatsAppNotificationType,
) {
    const firstName = appointment.client_name.trim().split(/\s+/)[0] || appointment.client_name;
    const date = formatAppointmentDateForMessage(appointment.appointment_date);
    const time = String(appointment.start_time).slice(0, 5);

    if (type === "attendance-confirmation") {
        return `Oie ${firstName}! Tudo bem? Passando pra lembrar do seu horário comigo amanhã, dia ${date}, às ${time}. Posso confirmar sua presença? 💅`;
    }

    return `Oie ${firstName}! Tudo bem? Passando para lembrar do nosso horário de hoje, às ${time}. Estarei te esperando. 💅`;
}

function getWhatsAppNotificationLabel(type: WhatsAppNotificationType) {
    if (type === "attendance-confirmation") return "Solicitar confirmação";
    return "Enviar lembrete";
}


const adminEnhancementStyles = `
.admin-dashboard-cards {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 18px;
}
.admin-dashboard-card {
    border: 1px solid #e5d2d8;
    border-radius: 17px;
    padding: 18px;
    background: #fff;
    color: #6d3445;
    text-align: left;
    cursor: pointer;
    box-shadow: 0 9px 26px rgba(83, 48, 58, 0.06);
}
.admin-dashboard-card strong,
.admin-dashboard-card span {
    display: block;
}
.admin-dashboard-card strong {
    font-size: 1rem;
    margin-bottom: 5px;
}
.admin-dashboard-card span {
    color: #80666e;
    font-size: .82rem;
}
.admin-dashboard-card.is-active {
    color: #fff;
    border-color: transparent;
    background: linear-gradient(135deg, #6d3445, #a86175);
}
.admin-dashboard-card.is-active span { color: rgba(255,255,255,.82); }

.admin-content-section {
    display: grid;
    gap: 16px;
}
.admin-section-heading {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-end;
    padding: 18px 20px;
    border: 1px solid #eadde1;
    border-radius: 18px;
    background: #fff;
}
.admin-section-heading h2 { margin: 0 0 5px; }
.admin-section-heading p { margin: 0; color: #80666e; }
.admin-section-date-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
}
.admin-section-date-controls button {
    border: 1px solid #d7c0c7;
    border-radius: 10px;
    padding: 10px 13px;
    background: #fff;
    color: #6d3445;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
}
.admin-section-date-controls input {
    border: 1px solid #d7c0c7;
    border-radius: 10px;
    padding: 10px 12px;
    font: inherit;
}
.admin-section-date-controls--agenda {
    align-items: stretch;
}
.admin-agenda-date-picker {
    position: relative;
    flex: 1 1 260px;
    min-width: 220px;
}
.admin-agenda-date-picker__trigger {
    width: 100%;
    min-height: 58px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 12px 16px !important;
    text-align: left;
    border-radius: 16px !important;
}
.admin-agenda-date-picker__trigger.is-open {
    border-color: #b76f86;
    background: #fff8fa;
}
.admin-agenda-date-picker__trigger-text {
    display: grid;
    gap: 4px;
    min-width: 0;
}
.admin-agenda-date-picker__trigger-text small {
    color: #8e6b76;
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.admin-agenda-date-picker__trigger-text strong {
    color: #5b3744;
    font-size: 0.98rem;
    line-height: 1.25;
    overflow-wrap: anywhere;
}
.admin-agenda-date-picker__chevron {
    color: #8b5366;
    font-size: 1rem;
    line-height: 1;
}
.admin-agenda-date-picker__panel {
    position: absolute;
    top: calc(100% + 10px);
    left: 0;
    z-index: 40;
    width: min(620px, calc(100vw - 48px));
    max-width: 100%;
    display: grid;
    gap: 16px;
    padding: 18px;
    border: 1px solid #ead9de;
    border-radius: 24px;
    background: #fff;
    box-shadow: 0 18px 40px rgba(83, 48, 58, 0.14);
}
.admin-agenda-date-picker__panel-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
}
.admin-agenda-date-picker__month {
    display: flex;
    align-items: center;
    gap: 10px;
}
.admin-agenda-date-picker__month strong {
    color: #5b3944;
    font-size: 1rem;
    text-transform: capitalize;
}
.admin-agenda-date-picker__month button,
.admin-agenda-date-picker__panel-navs button {
    width: 44px;
    height: 44px;
    padding: 0 !important;
    border-radius: 14px !important;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.admin-agenda-date-picker__panel-navs {
    display: flex;
    gap: 8px;
}
.admin-agenda-date-picker__week-days {
    display: grid;
    gap: 10px;
}
.admin-agenda-date-picker__week-days .client-week-day {
    min-height: 78px;
}
@media (max-width: 640px) {
    .admin-agenda-date-picker {
        flex-basis: 100%;
        min-width: 0;
    }

    .admin-agenda-date-picker__panel {
        width: min(calc(100vw - 36px), 100%);
        padding: 16px;
    }

    .admin-agenda-date-picker__panel-header {
        flex-direction: column;
        align-items: stretch;
    }

    .admin-agenda-date-picker__month,
    .admin-agenda-date-picker__panel-navs {
        justify-content: space-between;
    }
}

.admin-card-list {
    display: grid;
    gap: 13px;
}
.admin-day-group {
    display: grid;
    gap: 11px;
}
.admin-day-group__title {
    margin: 8px 0 0;
    padding: 11px 14px;
    border-radius: 12px;
    background: #efe3e7;
    color: #5e3542;
    text-transform: capitalize;
}
.admin-booking-card {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #e0c7cf;
    border-left: 6px solid #8b485d;
    border-radius: 17px;
    padding: 17px 18px;
    background: linear-gradient(135deg, #fff, #fbf4f6);
    box-shadow: 0 9px 26px rgba(83, 48, 58, 0.07);
    text-align: left;
    cursor: pointer;
}
.admin-booking-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 13px 32px rgba(83, 48, 58, 0.1);
}
.admin-booking-card.is-cancelled {
    opacity: .68;
    border-left-color: #aaa0a4;
}
.admin-booking-card__top {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: flex-start;
}
.admin-booking-card__time {
    color: #8b485d;
    font-size: 1.08rem;
    font-weight: 900;
}
.admin-booking-card h3 {
    margin: 5px 0 0;
    color: #302126;
}
.admin-booking-card__details {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-top: 14px;
}
.admin-booking-card__details div {
    padding: 10px 11px;
    border-radius: 11px;
    background: #f7ecef;
}
.admin-booking-card__details span,
.admin-booking-card__details strong {
    display: block;
}
.admin-booking-card__details span {
    color: #80666e;
    font-size: .7rem;
    font-weight: 800;
    text-transform: uppercase;
}
.admin-booking-card__details strong {
    margin-top: 4px;
    color: #4d363e;
    font-size: .84rem;
    overflow-wrap: anywhere;
}
.admin-booking-card__footer {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 13px;
}
.admin-booking-card__footer a,
.admin-booking-card__footer button {
    border: 0;
    border-radius: 9px;
    padding: 9px 11px;
    color: #fff;
    font: inherit;
    font-size: .78rem;
    font-weight: 800;
    text-decoration: none;
    cursor: pointer;
}
.admin-booking-card__footer button { background: #6d3445; }
.admin-booking-card__footer a { background: #1f9d59; }


.admin-booking-card__footer a.is-due {
    background: #c56b2f;
}
.admin-booking-card__footer a.is-opened {
    background: #7f777a;
}
.admin-message-center {
    display: grid;
    gap: 12px;
    margin-bottom: 18px;
    padding: 18px;
    border: 1px solid #e4cfd6;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 10px 28px rgba(83, 48, 58, 0.06);
}
.admin-message-center__header {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: center;
}
.admin-message-center__header h2 {
    margin: 0 0 5px;
    font-size: 1.05rem;
}
.admin-message-center__header p {
    margin: 0;
    color: #80666e;
    font-size: .86rem;
}
.admin-message-center__count {
    min-width: 64px;
    height: 46px;
    display: grid;
    place-items: center;
    border: 1px solid #d8bfc7;
    border-radius: 14px;
    padding: 0 14px;
    box-sizing: border-box;
    background: #fff7f9;
    color: #7a3f52;
    font-weight: 900;
    box-shadow: 0 6px 16px rgba(83, 48, 58, 0.06);
}
.admin-message-center__list {
    display: grid;
    gap: 9px;
}
.admin-message-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 12px 13px;
    border-radius: 13px;
    background: #f8f1f3;
}
.admin-message-item strong,
.admin-message-item span {
    display: block;
}
.admin-message-item span {
    margin-top: 4px;
    color: #80666e;
    font-size: .8rem;
}
.admin-message-item a {
    border-radius: 10px;
    padding: 10px 12px;
    background: #1f9d59;
    color: #fff;
    font-size: .78rem;
    font-weight: 850;
    text-decoration: none;
    white-space: nowrap;
}
.admin-message-center__empty {
    margin: 0;
    color: #80666e;
    font-size: .88rem;
}

.admin-edit-form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 13px;
}
.admin-edit-form label {
    display: grid;
    gap: 7px;
    font-size: .84rem;
    font-weight: 800;
}
.admin-edit-form input,
.admin-edit-form select {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #d8c7cc;
    border-radius: 11px;
    padding: 11px 12px;
    font: inherit;
}
.admin-edit-form__full { grid-column: 1 / -1; }
.admin-edit-actions {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin-top: 5px;
}
.admin-edit-actions button {
    border: 0;
    border-radius: 10px;
    padding: 11px 14px;
    color: #fff;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
}
.admin-edit-actions .save { background: #6d3445; }
.admin-edit-actions .cancel { background: #a23f4d; }
.admin-edit-actions .delete { background: #3e272d; }
.admin-edit-actions .close { background: #8a7078; }

.admin-client-card__actions .is-danger {
    background: #a23f4d;
    color: #fff;
}
.admin-client-card__metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.admin-block-manager--bottom {
    margin-top: 22px;
    margin-bottom: 0;
}
.admin-block-date-row {
    display: grid;
    grid-template-columns: minmax(180px, 260px) minmax(220px, 1fr);
    gap: 13px;
    align-items: end;
}
.admin-block-date-row label {
    display: grid;
    gap: 7px;
    font-weight: 800;
    font-size: .84rem;
}
.admin-block-date-row input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #d8c7cc;
    border-radius: 11px;
    padding: 11px 12px;
    font: inherit;
}
.admin-block-times {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
    gap: 9px;
    margin-top: 15px;
}
.admin-block-time {
    border: 1px solid #d9c1c8;
    border-radius: 11px;
    padding: 11px 8px;
    background: #fff;
    color: #6d3445;
    font: inherit;
    font-weight: 850;
    cursor: pointer;
}
.admin-block-time.is-selected {
    background: #6d3445;
    color: #fff;
    border-color: #6d3445;
}
.admin-block-submit-row {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) auto;
    gap: 10px;
    margin-top: 14px;
}
.admin-block-submit-row input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #d8c7cc;
    border-radius: 11px;
    padding: 11px 12px;
    font: inherit;
}
.admin-block-submit-row button {
    border: 0;
    border-radius: 11px;
    padding: 11px 16px;
    background: #6d3445;
    color: #fff;
    font: inherit;
    font-weight: 850;
    cursor: pointer;
}
.admin-block-submit-row button:disabled { opacity: .55; cursor: wait; }


.admin-top-agenda {
    display: grid;
    gap: 13px;
    margin-bottom: 18px;
}
.admin-top-agenda__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 16px 18px;
    border: 1px solid rgba(154, 83, 104, 0.2);
    border-radius: 18px;
    background: #fff;
}
.admin-top-agenda__header span,
.admin-top-agenda__header strong { display: block; }
.admin-top-agenda__header span {
    margin-bottom: 5px;
    color: #8a7078;
    font-size: .78rem;
    font-weight: 800;
    text-transform: uppercase;
}
.admin-top-agenda__header strong {
    color: #4d3039;
    text-transform: capitalize;
}
.admin-top-agenda .admin-booking-card {
    border: 1px solid rgba(255,255,255,.14);
    border-left: 0;
    background: linear-gradient(135deg, #71364a, #a66075);
    color: #fff;
    box-shadow: 0 14px 34px rgba(83, 48, 58, 0.16);
}
.admin-top-agenda .admin-booking-card:hover {
    box-shadow: 0 18px 40px rgba(83, 48, 58, 0.22);
}
.admin-top-agenda .admin-booking-card h3,
.admin-top-agenda .admin-booking-card__time,
.admin-top-agenda .admin-booking-card__details strong { color: #fff; }
.admin-top-agenda .admin-booking-card__details div {
    background: rgba(255,255,255,.11);
}
.admin-top-agenda .admin-booking-card__details span {
    color: rgba(255,255,255,.74);
}
.admin-top-agenda .admin-booking-card.is-cancelled {
    background: linear-gradient(135deg, #777073, #9a8f93);
}
.admin-empty--top {
    border: 1px dashed #d9bec7;
    background: rgba(255,255,255,.9);
}

@media (max-width: 850px) {
    .admin-dashboard-cards { grid-template-columns: 1fr 1fr; }
    .admin-booking-card__details { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 620px) {
    .admin-dashboard-cards,
    .admin-booking-card__details,
    .admin-edit-form,
    .admin-block-date-row,
    .admin-block-submit-row {
        grid-template-columns: 1fr;
    }
    .admin-edit-form__full,
    .admin-edit-actions { grid-column: auto; }
    .admin-section-heading,
    .admin-top-agenda__header,
    .admin-booking-card__top { flex-direction: column; align-items: stretch; }

    .admin-message-center__header {
        align-items: stretch;
        flex-direction: column;
    }

    .admin-message-item {
        grid-template-columns: 1fr;
        align-items: stretch;
    }
}

/* Financeiro */
.admin-finance {
    display: grid;
    gap: 20px;
}

.admin-finance__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    padding: 22px;
    border: 1px solid rgba(125, 78, 91, 0.12);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 14px 38px rgba(83, 48, 58, 0.07);
}

.admin-finance__eyebrow {
    display: block;
    margin-bottom: 6px;
    color: #9a5368;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.admin-finance__header h2,
.admin-finance__services h3 {
    margin: 0;
    color: #35272c;
}

.admin-finance__header p,
.admin-finance__services p {
    margin: 7px 0 0;
    color: #755961;
}

.admin-finance-month-picker {
    position: relative;
    width: min(100%, 430px);
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    overflow: visible;
}

.admin-finance-month-picker__quick {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr) 52px;
    align-items: stretch;
    gap: 10px;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
}

.admin-finance-month-picker__quick > button {
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    border: 1px solid #d8c0c8;
    border-radius: 14px;
    background: #fff;
    color: #7b4053;
    font: inherit;
    font-weight: 900;
    cursor: pointer;
}

.admin-finance-month-picker__selected {
    display: grid !important;
    grid-template-columns: 42px minmax(0, 1fr) 30px !important;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 58px;
    padding: 9px 12px !important;
    box-sizing: border-box;
    overflow: hidden;
    text-align: left;
    background:
        linear-gradient(135deg, #fffafb, #f7e9ee) !important;
    box-shadow: 0 8px 22px rgba(103, 57, 72, .07);
    transition: border-color .18s ease, box-shadow .18s ease;
}

.admin-finance-month-picker__selected.is-open {
    border-color: #b8798d !important;
    box-shadow: 0 10px 28px rgba(103, 57, 72, .12);
}

.admin-finance-month-picker__icon {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: #efdce2;
    font-size: 1.05rem;
}

.admin-finance-month-picker__selected-text {
    min-width: 0;
    display: grid;
    gap: 2px;
    text-transform: capitalize;
}

.admin-finance-month-picker__selected-text small {
    color: #9b7d87;
    font-size: .62rem;
    font-weight: 850;
    text-transform: uppercase;
    letter-spacing: .07em;
}

.admin-finance-month-picker__selected-text strong {
    display: block;
    max-width: 100%;
    color: #623a48;
    font-size: .9rem;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.admin-finance-month-picker__chevron {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #fff;
    color: #854d5f;
}

.admin-finance-month-panel {
    position: absolute;
    z-index: 30;
    top: calc(100% + 10px);
    left: 0;
    right: 0;
    display: grid;
    gap: 14px;
    padding: 16px;
    border: 1px solid #dfcbd1;
    border-radius: 20px;
    background: #fff;
    box-shadow: 0 20px 50px rgba(72, 39, 51, .16);
}

.admin-finance-month-panel__header {
    display: grid;
    grid-template-columns: 42px 1fr 42px;
    align-items: center;
    gap: 10px;
}

.admin-finance-month-panel__header strong {
    text-align: center;
    color: #543740;
    font-size: 1rem;
}

.admin-finance-month-panel__header button,
.admin-finance-month-panel__current {
    border: 1px solid #dfcbd1;
    border-radius: 11px;
    background: #fff8fa;
    color: #814b5d;
    font: inherit;
    font-weight: 900;
    cursor: pointer;
}

.admin-finance-month-panel__header button {
    height: 40px;
}

.admin-finance-month-panel__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 9px;
}

.admin-finance-month-panel__grid button {
    min-height: 64px;
    display: grid;
    place-items: center;
    gap: 3px;
    border: 1px solid #ead9de;
    border-radius: 14px;
    padding: 8px;
    background: #fffafb;
    color: #70505a;
    font: inherit;
    cursor: pointer;
}

.admin-finance-month-panel__grid button span {
    color: #a4828c;
    font-size: .63rem;
    font-weight: 850;
    text-transform: uppercase;
}

.admin-finance-month-panel__grid button strong {
    font-size: .76rem;
}

.admin-finance-month-panel__grid button.is-selected {
    border-color: #9a5368;
    background: linear-gradient(135deg, #965168, #74384b);
    color: #fff;
    box-shadow: 0 7px 18px rgba(116, 56, 75, .18);
}

.admin-finance-month-panel__grid button.is-selected span {
    color: rgba(255,255,255,.78);
}

.admin-finance-month-panel__current {
    width: 100%;
    min-height: 42px;
}

.admin-finance__period {
    display: flex;
    gap: 7px;
    align-items: baseline;
    padding: 0 4px;
    color: #80666e;
    text-transform: capitalize;
}

.admin-finance__period strong {
    color: #4a343b;
    font-size: 1.06rem;
}

.admin-finance__cards {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
}

.admin-finance-card {
    min-height: 132px;
    padding: 20px;
    border: 1px solid rgba(125, 78, 91, 0.13);
    border-radius: 20px;
    background: #fff;
    box-shadow: 0 12px 32px rgba(83, 48, 58, 0.06);
}

.admin-finance-card span,
.admin-finance-card small {
    display: block;
}

.admin-finance-card span {
    color: #80666e;
    font-size: 0.8rem;
    font-weight: 850;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.admin-finance-card strong {
    display: block;
    margin: 12px 0 8px;
    color: #4f303a;
    font-size: clamp(1.45rem, 3vw, 2rem);
}

.admin-finance-card small {
    color: #91747c;
    line-height: 1.35;
}

.admin-finance-card--completed {
    background: linear-gradient(145deg, #fff, #f0f8f2);
}

.admin-finance-card--forecast {
    background: linear-gradient(145deg, #fff, #f8edf1);
}

.admin-finance__services {
    padding: 22px;
    border: 1px solid rgba(125, 78, 91, 0.12);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 14px 38px rgba(83, 48, 58, 0.07);
}

.admin-finance__services-header {
    margin-bottom: 18px;
}

.admin-finance-service-cards {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    display: grid;
    gap: 14px;
    box-sizing: border-box;
}

.admin-finance-service-card {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    box-sizing: border-box;
    border: 1px solid #ead9de;
    border-radius: 18px;
    background: #fff;
    box-shadow: 0 8px 24px rgba(83, 48, 58, 0.05);
}

.admin-finance-service-card__row {
    min-width: 0;
    display: grid;
    gap: 5px;
    padding: 14px 16px;
    box-sizing: border-box;
    border-bottom: 1px solid #f0e4e8;
}

.admin-finance-service-card__row span {
    color: #8b7078;
    font-size: 0.69rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.045em;
}

.admin-finance-service-card__row strong {
    color: #5b3c46;
    font-size: 0.96rem;
    line-height: 1.3;
    overflow-wrap: anywhere;
}

.admin-finance-service-card__row--service {
    background: linear-gradient(135deg, #fffafb, #f8edf1);
}

.admin-finance-service-card__row--service strong {
    color: #473239;
    font-size: 1rem;
}

.admin-finance-service-card__row--total {
    border-bottom: 0;
    background: #f7e9ee;
}

.admin-finance-service-card__row--total strong {
    color: #793e51;
    font-size: 1.05rem;
}

.admin-finance__empty {
    display: grid;
    gap: 6px;
    padding: 30px 18px;
    border-radius: 16px;
    background: #faf6f7;
    text-align: center;
    color: #80666e;
}

.admin-finance__empty strong {
    color: #4d363e;
}

.admin-finance__note {
    margin: 0;
    padding: 13px 16px;
    border-radius: 14px;
    background: #f7eef1;
    color: #755961;
    font-size: 0.83rem;
}

@media (max-width: 980px) {
    .admin-finance__cards {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .admin-finance__header {
        flex-direction: column;
    }
}

@media (max-width: 620px) {
    .admin-finance__cards {
        grid-template-columns: 1fr;
    }

    .admin-finance,
    .admin-finance__header,
    .admin-finance__cards,
    .admin-finance__services,
    .admin-finance-service-cards,
    .admin-finance-service-card {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }

    .admin-finance__services {
        overflow: hidden;
    }

    .admin-finance-service-card__row {
        padding: 13px 14px;
    }

    .admin-finance-month-picker {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        align-self: stretch;
    }

    .admin-finance-month-picker__quick {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        grid-template-columns: 46px minmax(0, 1fr) 46px;
    }

    .admin-finance-month-picker__selected {
        min-width: 0;
        max-width: 100%;
        grid-template-columns: 40px minmax(0, 1fr) 28px !important;
        gap: 8px;
        padding: 8px 9px !important;
    }

    .admin-finance-month-picker__icon {
        width: 40px;
        height: 40px;
    }

    .admin-finance-month-picker__selected-text small {
        font-size: .56rem;
        letter-spacing: .055em;
    }

    .admin-finance-month-picker__selected-text strong {
        font-size: .83rem;
    }

    .admin-finance-month-panel {
        position: static;
        margin-top: 10px;
    }

    .admin-finance-month-panel__grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}


/* REGISTROS FOTOGRÁFICOS DAS UNHAS */

.admin-client-history {
    width: min(100%, 820px);
}

.admin-client-history__section {
    margin-top: 24px;
    padding-top: 22px;
    border-top: 1px solid #eee4e7;
}

.admin-client-history__section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
}

.admin-client-history__section-header h3 {
    margin: 0;
    color: #35272c;
    font-size: 1.05rem;
}

.admin-client-history__section-header p {
    margin: 5px 0 0;
    color: #80666e;
    font-size: 0.82rem;
    line-height: 1.5;
}

.admin-nail-record__new-button {
    flex: 0 0 auto;
    border: 0;
    border-radius: 11px;
    padding: 11px 14px;
    background: #6d3445;
    color: #fff;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 900;
    cursor: pointer;
}

.admin-nail-form {
    display: grid;
    gap: 15px;
    margin-bottom: 18px;
    padding: 18px;
    border: 1px solid #e8d8dd;
    border-radius: 16px;
    background: #fcf8f9;
}

.admin-nail-form__camera-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.admin-nail-form__file-button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 10px 14px;
    border: 1px solid #cfaab5;
    border-radius: 11px;
    background: #fff;
    color: #6d3445;
    font-size: 0.8rem;
    font-weight: 900;
    cursor: pointer;
    overflow: hidden;
}

.admin-nail-form__file-button.is-camera {
    background: linear-gradient(135deg, #a86175, #6d3445);
    border-color: transparent;
    color: #fff;
}

.admin-nail-form__file-button input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
}

.admin-nail-form textarea {
    width: 100%;
    min-height: 100px;
    resize: vertical;
    box-sizing: border-box;
    border: 1px solid #dbc5cc;
    border-radius: 12px;
    padding: 12px 13px;
    background: #fff;
    color: #35272c;
    font: inherit;
}

.admin-nail-form textarea:focus {
    outline: 2px solid rgba(184, 120, 139, 0.26);
    border-color: #a96679;
}

.admin-nail-form__previews {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
}

.admin-nail-form__preview {
    position: relative;
    overflow: hidden;
    border-radius: 13px;
    aspect-ratio: 1;
    background: #efe3e7;
}

.admin-nail-form__preview img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
}

.admin-nail-form__preview button {
    position: absolute;
    top: 7px;
    right: 7px;
    width: 30px;
    height: 30px;
    border: 0;
    border-radius: 50%;
    background: rgba(45, 25, 31, 0.84);
    color: #fff;
    font-size: 1rem;
    cursor: pointer;
}

.admin-nail-form__hint,
.admin-nail-form__message {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.5;
}

.admin-nail-form__hint {
    color: #80666e;
}

.admin-nail-form__message.is-error {
    color: #a02f3d;
}

.admin-nail-form__message.is-success {
    color: #287c4a;
}

.admin-nail-form__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.admin-nail-form__actions button {
    border: 0;
    border-radius: 11px;
    padding: 12px 15px;
    font: inherit;
    font-size: 0.8rem;
    font-weight: 900;
    cursor: pointer;
}

.admin-nail-form__actions .save {
    background: #6d3445;
    color: #fff;
}

.admin-nail-form__actions .cancel {
    background: #eadde1;
    color: #6d3445;
}

.admin-nail-form__actions button:disabled {
    opacity: 0.55;
    cursor: wait;
}

.admin-nail-records {
    display: grid;
    gap: 13px;
}

.admin-nail-record {
    padding: 15px;
    border: 1px solid #eadde1;
    border-radius: 15px;
    background: #fff;
}

.admin-nail-record__top {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
}

.admin-nail-record__top strong {
    color: #4d363e;
}

.admin-nail-record__top span {
    color: #8a7078;
    font-size: 0.76rem;
    white-space: nowrap;
}

.admin-nail-record__top-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.admin-nail-record__delete {
    border: 1px solid #e6b8bf;
    border-radius: 9px;
    padding: 7px 10px;
    background: #fff1f3;
    color: #a23f4d;
    font: inherit;
    font-size: 0.75rem;
    font-weight: 900;
    cursor: pointer;
}

.admin-nail-record__delete:hover {
    background: #ffe5e9;
}

.admin-nail-record__delete:disabled {
    opacity: 0.55;
    cursor: wait;
}

.admin-nail-record__notes {
    margin: 10px 0 0;
    color: #654d55;
    font-size: 0.86rem;
    line-height: 1.55;
    white-space: pre-wrap;
}

.admin-nail-record__photos {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 9px;
    margin-top: 13px;
}

.admin-nail-record__photos a {
    overflow: hidden;
    border-radius: 12px;
    aspect-ratio: 1;
    background: #efe3e7;
}

.admin-nail-record__photos img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
}

.admin-nail-records__empty,
.admin-nail-records__loading {
    padding: 18px;
    border-radius: 13px;
    background: #faf5f7;
    color: #80666e;
    text-align: center;
    font-size: 0.84rem;
}

@media (max-width: 620px) {
    .admin-client-history {
        width: min(100%, 650px);
        padding: 19px;
    }

    .admin-client-history__section-header {
        flex-direction: column;
    }

    .admin-nail-record__new-button {
        width: 100%;
    }

    .admin-nail-form__camera-actions,
    .admin-nail-form__actions {
        flex-direction: column;
    }

    .admin-nail-form__file-button,
    .admin-nail-form__actions button {
        width: 100%;
        box-sizing: border-box;
    }

    .admin-nail-form__previews,
    .admin-nail-record__photos {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .admin-nail-record__top {
        flex-direction: column;
    }
}



.admin-manual-booking {
    display: grid;
    gap: 14px;
    margin-top: 18px;
}

.admin-manual-booking__section {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 14px;
    padding: 18px;
    border: 1px solid #eadde1;
    border-radius: 18px;
    background: #fff;
}

.admin-manual-booking__step {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: linear-gradient(135deg, #a86175, #6d3445);
    color: #fff;
    font-size: .78rem;
    font-weight: 900;
}

.admin-manual-booking__content { min-width: 0; }
.admin-manual-booking__content h3 { margin: 0; color: #4d363e; }
.admin-manual-booking__content > p { margin: 6px 0 14px; color: #80666e; font-size: .84rem; }

.admin-manual-booking__service,
.admin-client-picker > input {
    width: 100%; box-sizing: border-box; border: 1px solid #dbc5cc; border-radius: 13px;
    padding: 12px 13px; background: #fff; color: #35272c; font: inherit;
}

.admin-client-picker { position: relative; }
.admin-client-picker__results {
    position: absolute; z-index: 20; top: calc(100% + 7px); left: 0; right: 0; max-height: 300px;
    overflow: auto; border: 1px solid #dbc5cc; border-radius: 14px; padding: 6px; background: #fff;
    box-shadow: 0 16px 40px rgba(83,48,58,.14);
}
.admin-client-picker__results button {
    width: 100%; display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 10px; align-items: center;
    border: 0; border-radius: 11px; padding: 9px; background: transparent; color: #4d363e; text-align: left; cursor: pointer;
}
.admin-client-picker__results button:hover { background: #faf5f7; }
.admin-client-picker__results strong, .admin-client-picker__results small { display: block; }
.admin-client-picker__results small { margin-top: 3px; color: #8a7078; }
.admin-client-picker__avatar {
    width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%;
    background: #f1e2e7; color: #7a4052; font-size: .72rem; font-weight: 900;
}
.admin-client-picker__empty { padding: 14px; color: #80666e; text-align: center; }

.admin-selected-client {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px;
    padding: 13px 14px; border: 1px solid #e2ccd3; border-radius: 14px; background: #faf5f7;
}
.admin-selected-client span, .admin-selected-client strong, .admin-selected-client small { display: block; }
.admin-selected-client span { color: #9a6c79; font-size: .68rem; font-weight: 900; text-transform: uppercase; }
.admin-selected-client strong { margin-top: 4px; color: #4d363e; }
.admin-selected-client small { margin-top: 3px; color: #80666e; }
.admin-selected-client button {
    border: 1px solid #d7c0c7; border-radius: 10px; padding: 8px 11px; background: #fff; color: #6d3445;
    font: inherit; font-weight: 850; cursor: pointer;
}

.admin-manual-week-picker { display: grid; gap: 12px; }
.admin-manual-week-picker__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.admin-manual-week-picker__month, .admin-manual-week-picker__navs { display: flex; align-items: center; gap: 8px; }
.admin-manual-week-picker__month strong { color: #4d363e; text-transform: capitalize; }
.admin-manual-week-picker__month button, .admin-manual-week-picker__navs button {
    width: 40px; height: 40px; border: 1px solid #dbc5cc; border-radius: 11px; background: #fff;
    color: #6d3445; font: inherit; font-weight: 900; cursor: pointer;
}

.admin-manual-week-days { display: grid; gap: 6px; }
.admin-manual-week-days__row { display: grid; gap: 6px; }
.admin-manual-week-days__row--four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.admin-manual-week-days__row--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.admin-manual-week-day {
    min-width: 0; border: 1px solid #e0d0d5; border-radius: 12px; padding: 9px 5px; background: #fff;
    color: #5d464d; font: inherit; cursor: pointer;
}
.admin-manual-week-day span, .admin-manual-week-day strong { display: block; }
.admin-manual-week-day span { color: #8a7078; font-size: .66rem; font-weight: 850; text-transform: capitalize; }
.admin-manual-week-day strong { margin-top: 3px; font-size: .9rem; }
.admin-manual-week-day.is-selected {
    border-color: #9a5368; background: #f7e9ed; color: #6d3445; box-shadow: 0 0 0 2px rgba(154,83,104,.12);
}
.admin-manual-week-day.is-past { opacity: .38; cursor: not-allowed; }

.admin-manual-month-calendar { border: 1px solid #eadde1; border-radius: 16px; padding: 13px; background: #fff; }
.admin-manual-month-calendar__header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.admin-manual-month-calendar__header strong { color: #4d363e; text-transform: capitalize; }
.admin-manual-month-calendar__header button {
    width: 36px; height: 36px; border: 1px solid #dbc5cc; border-radius: 9px; background: #fff; color: #6d3445; cursor: pointer;
}
.admin-manual-month-calendar__weekdays, .admin-manual-month-calendar__grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
.admin-manual-month-calendar__weekdays span { padding: 4px 0; color: #9a7a84; font-size: .65rem; font-weight: 900; text-align: center; }
.admin-manual-month-calendar__grid button { aspect-ratio: 1; border: 0; border-radius: 9px; background: #faf5f7; color: #5d464d; cursor: pointer; }
.admin-manual-month-calendar__grid button.is-selected { background: #8f3f58; color: #fff; font-weight: 900; }
.admin-manual-month-calendar__grid button.is-past { opacity: .3; cursor: not-allowed; }
.admin-manual-month-calendar__grid .is-empty { visibility: hidden; }

.admin-manual-times { display: grid; grid-template-columns: repeat(auto-fit, minmax(68px, 1fr)); gap: 7px; }
.admin-manual-times button {
    min-height: 38px; border: 1px solid #e0d0d5; border-radius: 10px; background: #fff; color: #5d464d;
    font: inherit; font-size: .82rem; font-weight: 850; cursor: pointer;
}
.admin-manual-times button.is-selected { border-color: #9a5368; background: #8f3f58; color: #fff; }
.admin-manual-times__empty { padding: 14px; border-radius: 12px; background: #faf5f7; color: #80666e; text-align: center; }

.admin-manual-booking__summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.admin-manual-booking__summary div { min-width: 0; padding: 12px; border-radius: 12px; background: #faf5f7; }
.admin-manual-booking__summary span, .admin-manual-booking__summary strong { display: block; }
.admin-manual-booking__summary span { margin-bottom: 4px; color: #9a707c; font-size: .68rem; font-weight: 850; text-transform: uppercase; }
.admin-manual-booking__summary strong { overflow-wrap: anywhere; color: #4d363e; font-size: .82rem; }
.admin-manual-booking__actions { display: flex; gap: 10px; }

@media (max-width: 760px) {
    .admin-manual-booking__section { grid-template-columns: 1fr; }
    .admin-manual-booking__step { width: 32px; height: 32px; }
    .admin-manual-booking__summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 520px) {
    .admin-manual-week-picker__top { align-items: flex-start; flex-direction: column; }
    .admin-manual-week-picker__navs { width: 100%; justify-content: flex-end; }
    .admin-manual-booking__summary { grid-template-columns: 1fr; }
    .admin-manual-booking__actions { flex-direction: column; }
}
`;


const MIRIAN_ADMIN_EMAIL = "mirian201420@gmail.com";


const adminServiceManagerStyles = `
.admin-service-manager {
    display: grid;
    gap: 22px;
}

.admin-schedule-config-card {
    display: grid;
    gap: 20px;
}
.admin-schedule-config-panel {
    gap: 16px;
}
.admin-schedule-config-manual-section {
    align-items: flex-start;
}
.admin-schedule-config-add-inline {
    display: grid;
    grid-template-columns: minmax(0, 220px) auto;
    gap: 12px;
    align-items: end;
    margin-top: 8px;
}
.admin-schedule-config-add-inline label,
.admin-schedule-config-editor__actions label {
    display: grid;
    gap: 7px;
}
.admin-schedule-config-add-inline label > span,
.admin-schedule-config-current-date span,
.admin-schedule-config-editor__header span,
.admin-schedule-config-editor__actions label > span {
    color: #9a5d70;
    font-size: .72rem;
    font-weight: 900;
    letter-spacing: .06em;
}
.admin-schedule-config-add-inline input,
.admin-schedule-config-editor__actions input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #dbc5cc;
    border-radius: 14px;
    padding: 13px 14px;
    background: #fff;
    color: #35272c;
    font: inherit;
}
.admin-schedule-config-add-inline button,
.admin-schedule-config-editor__actions button {
    border: 0;
    border-radius: 14px;
    padding: 13px 16px;
    background: linear-gradient(135deg, #7c4356, #b2607d);
    color: #fff;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
}
.admin-schedule-config-add-inline button:disabled,
.admin-schedule-config-editor__actions button:disabled {
    opacity: .6;
    cursor: wait;
}
.admin-schedule-config-current-date {
    display: grid;
    gap: 4px;
    margin-top: 16px;
}
.admin-schedule-config-current-date strong {
    color: #4f353e;
}
.admin-schedule-config-times-grid {
    margin-top: 14px;
}
.admin-schedule-config-editor {
    display: grid;
    gap: 12px;
    margin-top: 16px;
    padding: 16px;
    border: 1px solid #eadde1;
    border-radius: 20px;
    background: #fffafb;
}
.admin-schedule-config-editor__header {
    display: grid;
    gap: 4px;
}
.admin-schedule-config-editor__header strong {
    color: #4f353e;
    font-size: 1.1rem;
}
.admin-schedule-config-editor__actions {
    display: grid;
    grid-template-columns: minmax(0, 220px) repeat(3, auto);
    gap: 10px;
    align-items: end;
}
.admin-schedule-config-editor__actions .is-danger {
    background: #fff0f1;
    color: #a23f4d;
}
.admin-schedule-config-editor__actions .is-secondary {
    background: #eee4e7;
    color: #6d4853;
}
@media (max-width: 760px) {
    .admin-schedule-config-add-inline,
    .admin-schedule-config-editor__actions {
        grid-template-columns: 1fr;
    }
}
.admin-schedule-config-card .admin-service-form-card__heading p {
    max-width: 720px;
    margin: 6px 0 0;
    color: #8a7078;
    line-height: 1.5;
}
.admin-schedule-config-week {
    display: grid;
    gap: 12px;
    padding: 16px;
    border: 1px solid #eadde1;
    border-radius: 18px;
    background: #fffafb;
}
.admin-schedule-config-week__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: #563941;
    text-transform: capitalize;
}
.admin-schedule-config-week__top > div {
    display: flex;
    gap: 7px;
}
.admin-schedule-config-week__top button {
    width: 40px;
    height: 40px;
    border: 1px solid #dbc5cc;
    border-radius: 11px;
    background: #fff;
    color: #6d3445;
    font: inherit;
    font-size: 1.15rem;
    font-weight: 900;
    cursor: pointer;
}
.admin-schedule-config-selected-date {
    display: grid;
    gap: 4px;
    padding: 14px 16px;
    border-radius: 15px;
    background: #f8eef1;
}
.admin-schedule-config-selected-date span,
.admin-schedule-config-add label > span,
.admin-schedule-config-times__heading span {
    color: #9a5d70;
    font-size: .72rem;
    font-weight: 900;
    letter-spacing: .06em;
}
.admin-schedule-config-selected-date strong {
    color: #4f353e;
    text-transform: capitalize;
}
.admin-schedule-config-add {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: end;
}
.admin-schedule-config-add label {
    display: grid;
    gap: 7px;
}
.admin-schedule-config-add input,
.admin-schedule-config-time input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #dbc5cc;
    border-radius: 12px;
    padding: 12px 13px;
    background: #fff;
    color: #35272c;
    font: inherit;
}
.admin-schedule-config-add button,
.admin-schedule-config-time button {
    border: 0;
    border-radius: 11px;
    padding: 11px 14px;
    background: #7b3f53;
    color: #fff;
    font: inherit;
    font-weight: 900;
    cursor: pointer;
}
.admin-schedule-config-add button:disabled,
.admin-schedule-config-time button:disabled {
    opacity: .55;
    cursor: wait;
}
.admin-schedule-config-times {
    display: grid;
    gap: 12px;
}
.admin-schedule-config-times__heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
}
.admin-schedule-config-times__heading > div {
    display: grid;
    gap: 4px;
}
.admin-schedule-config-times__heading strong {
    color: #4f353e;
}
.admin-schedule-config-times__heading small {
    color: #927780;
}
.admin-schedule-config-time-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 9px;
}
.admin-schedule-config-time {
    display: grid;
    grid-template-columns: minmax(62px, 1fr) auto auto;
    gap: 7px;
    align-items: center;
    padding: 10px;
    border: 1px solid #eadde1;
    border-radius: 13px;
    background: #fff;
}
.admin-schedule-config-time strong {
    color: #50373f;
    font-size: 1rem;
}
.admin-schedule-config-time button.is-secondary {
    background: #eee4e7;
    color: #6d4853;
}
.admin-schedule-config-time button.is-danger {
    background: #fff0f1;
    color: #a23f4d;
}
.admin-schedule-config-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #9a5d70;
    font-size: .76rem;
    font-weight: 900;
    letter-spacing: .08em;
    text-transform: uppercase;
}
.admin-schedule-config-divider::before,
.admin-schedule-config-divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: #ead9de;
}
@media (max-width: 700px) {
    .admin-schedule-config-add {
        grid-template-columns: 1fr;
    }
    .admin-schedule-config-times__heading {
        align-items: flex-start;
        flex-direction: column;
    }
    .admin-schedule-config-time-list {
        grid-template-columns: 1fr;
    }
    .admin-schedule-config-time {
        grid-template-columns: 1fr 1fr;
    }
    .admin-schedule-config-time strong,
    .admin-schedule-config-time input {
        grid-column: 1 / -1;
    }
}
.admin-service-form-card,
.admin-service-list-section {
    border: 1px solid rgba(154, 97, 115, .16);
    border-radius: 24px;
    background: rgba(255,255,255,.94);
    padding: 22px;
    box-shadow: 0 16px 40px rgba(92, 56, 67, .07);
}
.admin-service-form-card__heading,
.admin-service-list-section__heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
}
.admin-service-form-card__heading span,
.admin-service-list-section__heading span {
    display: block;
    margin-bottom: 5px;
    color: #a16074;
    font-size: .72rem;
    font-weight: 900;
    letter-spacing: .14em;
}
.admin-service-form-card__heading h3,
.admin-service-list-section__heading h3 {
    margin: 0;
    color: #3e2d33;
    font-size: 1.35rem;
}
.admin-service-form-card__cancel {
    border: 1px solid #dcc4cb;
    border-radius: 12px;
    padding: 9px 12px;
    background: #fff;
    color: #7d4457;
    font: inherit;
    font-size: .78rem;
    font-weight: 800;
    cursor: pointer;
}
.admin-service-form-fields {
    display: grid;
    gap: 16px;
}
.admin-service-form-fields label {
    display: grid;
    gap: 8px;
}
.admin-service-form-fields label > span {
    color: #5d444c;
    font-size: .78rem;
    font-weight: 900;
    letter-spacing: .045em;
}
.admin-service-form-fields input {
    width: 100%;
    min-height: 52px;
    box-sizing: border-box;
    border: 1px solid #decbd1;
    border-radius: 14px;
    padding: 0 15px;
    background: #fffdfd;
    color: #33272b;
    font: inherit;
    outline: none;
}
.admin-service-form-fields input:focus {
    border-color: #a86175;
    box-shadow: 0 0 0 3px rgba(168,97,117,.1);
}
.admin-service-price-field,
.admin-service-duration-field {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    border: 1px solid #decbd1;
    border-radius: 14px;
    overflow: hidden;
    background: #fffdfd;
}
.admin-service-price-field > span,
.admin-service-duration-field > span {
    padding: 0 14px;
    color: #8c6c76;
    font-size: .86rem;
    font-weight: 800;
}
.admin-service-price-field input,
.admin-service-duration-field input {
    border: 0;
    border-radius: 0;
    box-shadow: none !important;
}
.admin-service-duration-field {
    grid-template-columns: minmax(0, 1fr) auto;
}
.admin-service-form-card__save {
    width: 100%;
    margin-top: 20px;
    border: 0;
    border-radius: 14px;
    padding: 15px 18px;
    background: linear-gradient(135deg, #a86175, #713c4c);
    color: #fff;
    font: inherit;
    font-weight: 900;
    cursor: pointer;
}
.admin-service-form-card__save:disabled {
    opacity: .55;
    cursor: wait;
}
.admin-service-list-section__heading > strong {
    display: grid;
    place-items: center;
    min-width: 42px;
    height: 42px;
    border-radius: 50%;
    background: #f6e9ed;
    color: #8f5063;
}
.admin-service-cards {
    display: grid;
    gap: 12px;
}
.admin-service-summary-card {
    border: 1px solid #ead9de;
    border-radius: 18px;
    background: #fff;
    overflow: hidden;
    cursor: pointer;
    transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
}
.admin-service-summary-card:hover,
.admin-service-summary-card.is-expanded {
    border-color: #c99daa;
    box-shadow: 0 10px 26px rgba(100, 57, 70, .08);
}
.admin-service-summary-card__main {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) auto;
    align-items: center;
    gap: 13px;
    padding: 16px;
}
.admin-service-summary-card__icon {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: #f8edf0;
    color: #9c5d70;
    font-size: 1.1rem;
}
.admin-service-summary-card__content > strong {
    display: block;
    margin-bottom: 9px;
    color: #382b30;
    font-size: 1rem;
}
.admin-service-summary-card__details {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
}
.admin-service-summary-card__details span {
    display: grid;
    gap: 1px;
}
.admin-service-summary-card__details small {
    color: #9b858c;
    font-size: .68rem;
}
.admin-service-summary-card__details b {
    color: #6f4854;
    font-size: .84rem;
}
.admin-service-summary-card__chevron {
    color: #9a6575;
    font-size: 1.25rem;
}
.admin-service-summary-card__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding: 0 16px 16px;
}
.admin-service-summary-card__actions button {
    border-radius: 12px;
    padding: 11px 12px;
    font: inherit;
    font-size: .8rem;
    font-weight: 900;
    cursor: pointer;
}
.admin-service-summary-card__actions .edit {
    border: 1px solid #cfaab5;
    background: #fff8fa;
    color: #824e5e;
}
.admin-service-summary-card__actions .delete {
    border: 1px solid #e4b7ba;
    background: #fff5f5;
    color: #9d444a;
}
.admin-service-summary-card__actions button:disabled {
    opacity: .5;
    cursor: wait;
}
@media (max-width: 620px) {
    .admin-service-form-card,
    .admin-service-list-section {
        padding: 17px;
        border-radius: 20px;
    }
    .admin-service-form-card__heading {
        flex-direction: column;
    }
    .admin-service-summary-card__details {
        gap: 10px;
    }
    .admin-service-summary-card__actions {
        grid-template-columns: 1fr;
    }
}
`;



const adminClientScheduledMetricStyles = `
@media (max-width: 620px) {
    .admin-client-card__metrics {
        gap: 7px;
    }

    .admin-client-card__metrics div {
        padding: 9px 8px;
    }

    .admin-client-card__metrics span {
        font-size: .61rem;
        line-height: 1.2;
    }

    .admin-client-card__metrics strong {
        font-size: .9rem;
    }
}
`;

const adminEditDateTimeStyles = `
.admin-edit-date-time {
    display: grid;
    gap: 9px;
}
.admin-edit-date-time__label {
    color: #513a42;
    font-size: .9rem;
    font-weight: 850;
}
.admin-edit-date-time__toggle {
    width: 100%;
    display: grid;
    grid-template-columns: 46px minmax(0, 1fr) 38px;
    align-items: center;
    gap: 12px;
    border: 1px solid #dfcbd1;
    border-radius: 17px;
    padding: 13px 14px;
    background:
        linear-gradient(135deg, rgba(255,248,250,.98), rgba(250,238,242,.98));
    color: #513a42;
    text-align: left;
    font: inherit;
    cursor: pointer;
    box-shadow: 0 8px 22px rgba(112, 62, 79, .07);
    transition:
        border-color .18s ease,
        box-shadow .18s ease,
        transform .18s ease;
}
.admin-edit-date-time__toggle:hover,
.admin-edit-date-time__toggle.is-open {
    border-color: #bd8798;
    box-shadow: 0 10px 28px rgba(112, 62, 79, .11);
}
.admin-edit-date-time__toggle:active {
    transform: scale(.995);
}
.admin-edit-date-time__icon {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border-radius: 14px;
    background: #f2dfe5;
    color: #874b5f;
    font-size: 1.25rem;
}
.admin-edit-date-time__selected {
    min-width: 0;
    display: grid;
    gap: 4px;
}
.admin-edit-date-time__selected small {
    color: #9b7f88;
    font-size: .66rem;
    font-weight: 850;
    text-transform: uppercase;
    letter-spacing: .075em;
}
.admin-edit-date-time__selected strong {
    color: #463138;
    font-size: .92rem;
    line-height: 1.25;
    overflow-wrap: anywhere;
}
.admin-edit-date-time__time {
    width: fit-content;
    margin-top: 2px;
    border-radius: 999px;
    padding: 5px 9px;
    background: #7d3f53;
    color: #fff;
    font-size: .78rem;
    font-weight: 900;
}
.admin-edit-date-time__chevron {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: #fff;
    color: #824b5d;
    font-size: 1rem;
    font-weight: 900;
    box-shadow: 0 4px 12px rgba(83, 47, 59, .08);
}
.admin-edit-date-time__picker {
    display: grid;
    gap: 18px;
    border: 1px solid #eadde1;
    border-radius: 18px;
    padding: 14px;
    background: #fffafb;
    box-shadow: 0 12px 30px rgba(86, 49, 62, .06);
}
.admin-edit-date-time__times {
    display: grid;
    gap: 10px;
}
.admin-edit-date-time__times-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: #563e47;
}
.admin-edit-date-time__times-heading span {
    color: #9b7a85;
    font-size: .75rem;
}
.admin-booking-card__music {
    grid-column: 1 / -1;
}
.admin-booking-card__music strong {
    white-space: normal;
    overflow-wrap: anywhere;
}
.admin-edit-form textarea,
.admin-client-editor textarea {
    width: 100%;
    box-sizing: border-box;
    min-height: 92px;
    resize: vertical;
    border: 1px solid #dbc5cc;
    border-radius: 12px;
    padding: 12px 13px;
    background: #fff;
    color: #35272c;
    font: inherit;
    line-height: 1.45;
}
.admin-edit-form textarea:focus,
.admin-client-editor textarea:focus {
    outline: none;
    border-color: #a86175;
    box-shadow: 0 0 0 3px rgba(168,97,117,.1);
}
.admin-anamnesis-card {
    display: grid;
    gap: 16px;
    margin-top: 8px;
    padding: 18px;
    border: 1px solid #e6d3d9;
    border-radius: 20px;
    background: linear-gradient(135deg, #fffafb, #f8eef1);
    box-shadow: 0 10px 26px rgba(93, 53, 66, .06);
}
.admin-anamnesis-card__header span {
    display: block;
    margin-bottom: 4px;
    color: #a26a7c;
    font-size: .68rem;
    font-weight: 900;
    letter-spacing: .1em;
    text-transform: uppercase;
}
.admin-anamnesis-card__header h3 {
    margin: 0;
    color: #4c333b;
    font-size: 1.12rem;
}
.admin-anamnesis-card__questions {
    display: grid;
    gap: 14px;
}
.admin-anamnesis-card__questions label {
    display: grid;
    gap: 7px;
    padding: 13px;
    border: 1px solid #eadde1;
    border-radius: 15px;
    background: rgba(255,255,255,.9);
}
.admin-anamnesis-card__questions label > span {
    color: #5e424b;
    font-size: .82rem;
    font-weight: 850;
    line-height: 1.35;
}
.admin-anamnesis-card__questions input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #dbc8ce;
    border-radius: 11px;
    padding: 11px 12px;
    background: #fff;
    color: #35272c;
    font: inherit;
}
.admin-anamnesis-card__questions input:focus {
    outline: none;
    border-color: #a86175;
    box-shadow: 0 0 0 3px rgba(168,97,117,.1);
}
.admin-anamnesis-card__loading {
    margin: 0;
    color: #80666e;
    font-size: .85rem;
}
@media (max-width: 620px) {
    .admin-edit-date-time__toggle {
        grid-template-columns: 42px minmax(0, 1fr) 34px;
        gap: 10px;
        padding: 12px;
        border-radius: 15px;
    }
    .admin-edit-date-time__icon {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        font-size: 1.1rem;
    }
    .admin-edit-date-time__selected strong {
        font-size: .88rem;
    }
    .admin-edit-date-time__picker {
        padding: 11px;
    }
}
`;


function AdminPanel() {
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [adminNow, setAdminNow] = useState(() => new Date());
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
    const [adminBlocks, setAdminBlocks] = useState<AdminScheduleBlock[]>([]);
    const [adminServices, setAdminServices] = useState<AdminServiceSetting[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [panelError, setPanelError] = useState("");
    const [notificationClock, setNotificationClock] = useState(() => Date.now());
    const [openedWhatsAppNotifications, setOpenedWhatsAppNotifications] = useState<Record<string, boolean>>(() => {
        try {
            const saved = window.localStorage.getItem("mirian-whatsapp-notifications-opened");
            return saved ? JSON.parse(saved) as Record<string, boolean> : {};
        } catch {
            return {};
        }
    });

    const [adminView, setAdminView] = useState<"agenda" | "week" | "clients" | "finance" | "schedule" | "settings">("agenda");
    const [agendaDate, setAgendaDate] = useState(formatDateForInput(new Date()));
    const [agendaWeekReferenceDate, setAgendaWeekReferenceDate] = useState(
        formatDateForInput(new Date()),
    );
    const [showAgendaDatePicker, setShowAgendaDatePicker] = useState(false);
    const [showAgendaMonthCalendar, setShowAgendaMonthCalendar] = useState(false);
    const [agendaCalendarMonth, setAgendaCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [financeMonth, setFinanceMonth] = useState(() => formatDateForInput(new Date()).slice(0, 7));
    const [showFinanceMonthPicker, setShowFinanceMonthPicker] = useState(false);
    const [financePickerYear, setFinancePickerYear] = useState(() => new Date().getFullYear());

    const [showManualForm, setShowManualForm] = useState(false);
    const [adminClientProfiles, setAdminClientProfiles] = useState<ClientProfile[]>([]);
    const [manualClientSearch, setManualClientSearch] = useState("");
    const [selectedManualClient, setSelectedManualClient] = useState<AdminBookingClient | null>(null);
    const [manualServiceName, setManualServiceName] = useState(fallbackServices[0].name);
    const [manualDate, setManualDate] = useState(formatDateForInput(new Date()));
    const [manualWeekReferenceDate, setManualWeekReferenceDate] = useState(formatDateForInput(new Date()));
    const [manualTime, setManualTime] = useState("");
    const [showManualMonthCalendar, setShowManualMonthCalendar] = useState(false);
    const [manualCalendarMonth, setManualCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [manualError, setManualError] = useState("");
    const [manualSuccess, setManualSuccess] = useState("");
    const [isSavingManualAppointment, setIsSavingManualAppointment] = useState(false);

    const [selectedAdminAppointment, setSelectedAdminAppointment] = useState<AdminAppointment | null>(null);
    const [editAppointmentName, setEditAppointmentName] = useState("");
    const [editAppointmentPhone, setEditAppointmentPhone] = useState("");
    const [editAppointmentEmail, setEditAppointmentEmail] = useState("");
    const [editAppointmentMusicTaste, setEditAppointmentMusicTaste] = useState("");
    const [editAppointmentService, setEditAppointmentService] = useState("");
    const [editAppointmentDate, setEditAppointmentDate] = useState("");
    const [editAppointmentTime, setEditAppointmentTime] = useState("");
    const [showEditDateTimePicker, setShowEditDateTimePicker] = useState(false);
    const [editWeekReferenceDate, setEditWeekReferenceDate] = useState(formatDateForInput(new Date()));
    const [showEditMonthCalendar, setShowEditMonthCalendar] = useState(false);
    const [editCalendarMonth, setEditCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [appointmentEditError, setAppointmentEditError] = useState("");
    const [isSavingAppointment, setIsSavingAppointment] = useState(false);

    const [clientSearch, setClientSearch] = useState("");
    const [selectedClient, setSelectedClient] = useState<AdminClient | null>(null);
    const [editingClient, setEditingClient] = useState<AdminClient | null>(null);
    const [editClientName, setEditClientName] = useState("");
    const [editClientPhone, setEditClientPhone] = useState("");
    const [editClientEmail, setEditClientEmail] = useState("");
    const [editClientMusicTaste, setEditClientMusicTaste] = useState("");
    const [clientAnamnesis, setClientAnamnesis] =
        useState<ClientAnamnesisForm>(emptyClientAnamnesis);
    const [isLoadingClientAnamnesis, setIsLoadingClientAnamnesis] = useState(false);
    const [clientEditError, setClientEditError] = useState("");
    const [isSavingClient, setIsSavingClient] = useState(false);
    const [deletingClientKey, setDeletingClientKey] = useState("");
    const [clearingCancelledAppointmentId, setClearingCancelledAppointmentId] =
        useState<string | null>(null);

    const [nailRecords, setNailRecords] = useState<NailRecord[]>([]);
    const [isLoadingNailRecords, setIsLoadingNailRecords] = useState(false);
    const [showNailRecordForm, setShowNailRecordForm] = useState(false);
    const [nailRecordNotes, setNailRecordNotes] = useState("");
    const [nailRecordFiles, setNailRecordFiles] = useState<File[]>([]);
    const [nailRecordError, setNailRecordError] = useState("");
    const [nailRecordSuccess, setNailRecordSuccess] = useState("");
    const [isSavingNailRecord, setIsSavingNailRecord] = useState(false);
    const [deletingNailRecordId, setDeletingNailRecordId] = useState<string | null>(null);

    const nailRecordFilePreviews = useMemo(
        () => nailRecordFiles.map((file) => ({
            file,
            url: URL.createObjectURL(file),
        })),
        [nailRecordFiles],
    );

    useEffect(() => {
        return () => {
            nailRecordFilePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
        };
    }, [nailRecordFilePreviews]);

    const [adminTimeOverrides, setAdminTimeOverrides] = useState<ScheduleTimeOverride[]>([]);

    const [scheduleConfigDate, setScheduleConfigDate] = useState(formatDateForInput(new Date()));
    const [scheduleConfigWeekReferenceDate, setScheduleConfigWeekReferenceDate] = useState(formatDateForInput(new Date()));
    const [scheduleConfigNewTime, setScheduleConfigNewTime] = useState("");
    const [scheduleConfigEditingTime, setScheduleConfigEditingTime] = useState<string | null>(null);
    const [scheduleConfigEditedTime, setScheduleConfigEditedTime] = useState("");
    const [scheduleConfigError, setScheduleConfigError] = useState("");
    const [scheduleConfigSuccess, setScheduleConfigSuccess] = useState("");
    const [isSavingScheduleConfig, setIsSavingScheduleConfig] = useState(false);

    const [blockDate, setBlockDate] = useState(formatDateForInput(new Date()));
    const [blockWeekReferenceDate, setBlockWeekReferenceDate] = useState(formatDateForInput(new Date()));
    const [selectedBlockTimes, setSelectedBlockTimes] = useState<string[]>([]);
    const [blockReason, setBlockReason] = useState("");
    const [blockError, setBlockError] = useState("");
    const [isSavingBlock, setIsSavingBlock] = useState(false);

    const [settingsError, setSettingsError] = useState("");
    const [settingsSuccess, setSettingsSuccess] = useState("");
    const [savingServiceId, setSavingServiceId] = useState<number | null>(null);
    const [serviceFormName, setServiceFormName] = useState("");
    const [serviceFormPrice, setServiceFormPrice] = useState("");
    const [serviceFormDuration, setServiceFormDuration] = useState("");
    const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
    const [expandedServiceId, setExpandedServiceId] = useState<number | null>(null);
    const [deletingServiceId, setDeletingServiceId] = useState<number | null>(null);

    useEffect(() => {
        const timer = window.setInterval(() => setNotificationClock(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const clock = window.setInterval(() => {
            setAdminNow(new Date());
        }, 30000);

        return () => window.clearInterval(clock);
    }, []);

    useEffect(() => {
        if (!isAuthenticated || !appointments.length) return;

        const completedIds = appointments
            .filter(
                (appointment) =>
                    (appointment.status === "confirmed" ||
                        appointment.status === "pending") &&
                    getAppointmentEndDateTime(appointment).getTime() <=
                    adminNow.getTime(),
            )
            .map((appointment) => appointment.id);

        if (!completedIds.length) return;

        let cancelled = false;

        async function markFinishedAppointmentsAsCompleted() {
            const {error} = await supabase
                .from("appointments")
                .update({status: "completed"})
                .in("id", completedIds);

            if (error) {
                console.error(
                    "Erro ao concluir atendimentos automaticamente:",
                    error,
                );
                return;
            }

            if (cancelled) return;

            setAppointments((current) =>
                current.map((appointment) =>
                    completedIds.includes(appointment.id)
                        ? {...appointment, status: "completed"}
                        : appointment,
                ),
            );
        }

        void markFinishedAppointmentsAsCompleted();

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, appointments, adminNow]);


    useEffect(() => {
        try {
            window.localStorage.setItem(
                "mirian-whatsapp-notifications-opened",
                JSON.stringify(openedWhatsAppNotifications),
            );
        } catch {
            // O painel continua funcionando mesmo se o navegador bloquear o armazenamento local.
        }
    }, [openedWhatsAppNotifications]);

    useEffect(() => {
        function sessionIsMirianAdmin(session: {user?: {email?: string | null}} | null) {
            return session?.user?.email?.trim().toLowerCase() === MIRIAN_ADMIN_EMAIL;
        }

        async function checkSession() {
            const {data: {session}} = await supabase.auth.getSession();
            setIsAuthenticated(sessionIsMirianAdmin(session));
            setIsCheckingSession(false);
        }

        void checkSession();

        const {data: {subscription}} = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthenticated(sessionIsMirianAdmin(session));
            setIsCheckingSession(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!isAuthenticated) {
            setAppointments([]);
            setAdminClientProfiles([]);
            return;
        }

        async function loadAdminData() {
            setIsLoading(true);
            setPanelError("");
            const [
                {data: appointmentData, error: appointmentError},
                {data: blockData, error: blockLoadError},
                {data: serviceData, error: serviceLoadError},
                {data: clientProfileData, error: clientProfileLoadError},
                {data: timeOverrideData, error: timeOverrideLoadError},
            ] = await Promise.all([
                supabase.from("appointments")
                    .select("id, client_id, client_name, client_phone, client_email, musical_taste, service_name, appointment_date, start_time, duration_minutes, price_cents, client_hidden, status, created_at")
                    .order("appointment_date", {ascending: true})
                    .order("start_time", {ascending: true}),
                supabase.from("schedule_blocks")
                    .select("id, block_date, start_time, end_time, reason, created_at")
                    .order("block_date", {ascending: true})
                    .order("start_time", {ascending: true}),
                supabase.from("services")
                    .select("id, name, description, duration_minutes, price_cents, display_order")
                    .order("price_cents", {ascending: false})
                    .order("name", {ascending: true}),
                supabase.from("client_profiles")
                    .select("id, full_name, phone, email, musical_taste, phone_digits, user_id, created_at, updated_at")
                    .order("full_name", {ascending: true}),
                supabase.from("schedule_time_overrides")
                    .select("id, override_date, start_time, is_available, created_at, updated_at")
                    .order("override_date", {ascending: true})
                    .order("start_time", {ascending: true}),
            ]);

            if (timeOverrideLoadError) {
                console.warn("Exceções de horário ainda não disponíveis no ADM:", timeOverrideLoadError);
            }

            if (appointmentError || blockLoadError || serviceLoadError || clientProfileLoadError) {
                console.error("Erro ao carregar painel:", appointmentError || blockLoadError || serviceLoadError || clientProfileLoadError);
                setPanelError("Não foi possível carregar os dados do painel. Atualize a página.");
                setIsLoading(false);
                return;
            }

            setAppointments((appointmentData ?? []) as AdminAppointment[]);
            setAdminBlocks((blockData ?? []) as AdminScheduleBlock[]);
            setAdminServices((serviceData ?? []) as AdminServiceSetting[]);
            setAdminClientProfiles((clientProfileData ?? []) as ClientProfile[]);
            setAdminTimeOverrides(
                ((timeOverrideData ?? []) as ScheduleTimeOverride[]).map((item) => ({
                    ...item,
                    start_time: String(item.start_time).slice(0, 5),
                })),
            );
            if (serviceData?.length) setManualServiceName(serviceData[0].name);
            setIsLoading(false);
        }

        void loadAdminData();
        const appointmentsChannel = supabase.channel("admin-appointments-updates")
            .on("postgres_changes", {event: "*", schema: "public", table: "appointments"}, () => void loadAdminData())
            .subscribe();
        const blocksChannel = supabase.channel("admin-schedule-blocks-updates")
            .on("postgres_changes", {event: "*", schema: "public", table: "schedule_blocks"}, () => void loadAdminData())
            .subscribe();

        const clientProfilesChannel = supabase.channel("admin-client-profiles-updates")
            .on(
                "postgres_changes",
                {event: "*", schema: "public", table: "client_profiles"},
                () => void loadAdminData(),
            )
            .subscribe();

        const timeOverridesChannel = supabase.channel("admin-schedule-time-overrides-updates")
            .on(
                "postgres_changes",
                {event: "*", schema: "public", table: "schedule_time_overrides"},
                () => void loadAdminData(),
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(appointmentsChannel);
            void supabase.removeChannel(blocksChannel);
            void supabase.removeChannel(clientProfilesChannel);
            void supabase.removeChannel(timeOverridesChannel);
        };
    }, [isAuthenticated]);

    async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoginError("");
        setIsLoggingIn(true);

        const normalizedEmail = email.trim().toLowerCase();

        if (normalizedEmail !== MIRIAN_ADMIN_EMAIL) {
            setLoginError("Esta conta não possui acesso ao painel administrativo.");
            setIsLoggingIn(false);
            return;
        }

        const {data, error} = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
        });

        if (error || data.user?.email?.trim().toLowerCase() !== MIRIAN_ADMIN_EMAIL) {
            if (data.session) {
                await supabase.auth.signOut();
            }

            setLoginError("E-mail ou senha incorretos.");
            setIsLoggingIn(false);
            return;
        }

        setPassword("");
        setIsAuthenticated(true);
        setIsLoggingIn(false);
    }

    async function handleLogout() {
        await supabase.auth.signOut();
    }

    function appointmentConflicts(
        appointmentId: string,
        date: string,
        time: string,
        durationMinutes: number,
    ) {
        const start = getMinutesFromTime(time);
        const end = start + durationMinutes;
        const conflictsAppointment = appointments.some((appointment) => {
            if (appointment.id === appointmentId || appointment.status === "cancelled" || appointment.appointment_date !== date) return false;
            const existingStart = getMinutesFromTime(appointment.start_time);
            return intervalsOverlap(start, end, existingStart, existingStart + appointment.duration_minutes);
        });
        const conflictsBlock = adminBlocks.some((block) =>
            block.block_date === date &&
            intervalsOverlap(start, end, getMinutesFromTime(block.start_time), getMinutesFromTime(block.end_time)),
        );
        return conflictsAppointment || conflictsBlock;
    }

    async function createManualAppointment(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setManualError("");
        setManualSuccess("");

        if (!selectedManualClient) {
            setManualError("Busque e selecione uma cliente cadastrada.");
            return;
        }

        if (!manualDate || !manualTime) {
            setManualError("Escolha a data e o horário.");
            return;
        }

        const now = new Date();
        const selectedDateTime = new Date(`${manualDate}T${manualTime}:00`);

        if (Number.isNaN(selectedDateTime.getTime()) || selectedDateTime.getTime() <= now.getTime()) {
            setManualError("Não é possível criar um agendamento em uma data ou horário que já passou.");
            return;
        }

        const service = adminServices.find((item) => item.name === manualServiceName);

        if (!service) {
            setManualError("Escolha um serviço válido.");
            return;
        }

        if (appointmentConflicts("", manualDate, manualTime, service.duration_minutes)) {
            setManualError("Este período entra em conflito com outro agendamento ou bloqueio.");
            return;
        }

        setIsSavingManualAppointment(true);

        try {
            const {data: createdData, error: createError} = await supabase.rpc(
                "admin_create_client_appointment",
                {
                    p_client_profile_id: selectedManualClient.profileId,
                    p_client_name: selectedManualClient.name,
                    p_client_phone: selectedManualClient.phone,
                    p_client_email: selectedManualClient.email || null,
                    p_service_name: service.name,
                    p_appointment_date: manualDate,
                    p_start_time: manualTime,
                    p_duration_minutes: service.duration_minutes,
                    p_price_cents: service.price_cents,
                },
            );

            if (createError) {
                console.error("Erro detalhado ao criar agendamento administrativo:", createError);

                const details = [
                    createError.message,
                    createError.details,
                    createError.hint,
                    createError.code ? `Código ${createError.code}` : "",
                ].filter(Boolean).join(" • ");

                throw new Error(details || "O Supabase recusou a criação do agendamento.");
            }

            const createdRow = Array.isArray(createdData)
                ? createdData[0]
                : createdData;

            if (!createdRow?.id) {
                console.error("Retorno inesperado da função administrativa:", createdData);
                throw new Error("O agendamento não retornou os dados esperados.");
            }

            const createdAppointment = createdRow as AdminAppointment;

            setAppointments((current) => [
                ...current.filter((item) => item.id !== createdAppointment.id),
                createdAppointment,
            ]);

            if (createdRow.client_id) {
                setAdminClientProfiles((current) => {
                    if (current.some((profile) => profile.id === createdRow.client_id)) {
                        return current;
                    }

                    return [
                        ...current,
                        {
                            id: createdRow.client_id,
                            full_name: createdRow.client_name,
                            phone: createdRow.client_phone,
                            email: createdRow.client_email,
                        } as ClientProfile,
                    ].sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
                });
            }

            setManualSuccess(
                `Agendamento de ${createdRow.client_name} criado com sucesso e vinculado ao perfil da cliente.`,
            );
            setAgendaDate(manualDate);
            setManualTime("");
        } catch (error) {
            console.error("Erro ao criar agendamento:", error);

            const message =
                error instanceof Error
                    ? error.message
                    : "Erro desconhecido retornado pelo Supabase.";

            setManualError(`Não foi possível criar o agendamento: ${message}`);
        } finally {
            setIsSavingManualAppointment(false);
        }
    }

    function openAppointmentDetails(appointment: AdminAppointment) {
        setSelectedAdminAppointment(appointment);
        setEditAppointmentName(appointment.client_name);
        setEditAppointmentPhone(appointment.client_phone);
        setEditAppointmentEmail(appointment.client_email ?? "");
        setEditAppointmentMusicTaste(appointment.musical_taste ?? "");
        setEditAppointmentService(appointment.service_name);
        setEditAppointmentDate(appointment.appointment_date);
        setEditAppointmentTime(String(appointment.start_time).slice(0, 5));
        setEditWeekReferenceDate(appointment.appointment_date);

        const appointmentDate = new Date(`${appointment.appointment_date}T12:00:00`);
        setEditCalendarMonth(
            new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), 1),
        );

        setShowEditDateTimePicker(false);
        setShowEditMonthCalendar(false);
        setAppointmentEditError("");
    }

    const editVisibleWeekDates = useMemo(
        () => getManualWeekDates(editWeekReferenceDate),
        [editWeekReferenceDate],
    );

    function selectEditAppointmentDate(date: string) {
        const today = formatDateForInput(new Date());

        if (date < today) return;

        setEditAppointmentDate(date);
        setEditWeekReferenceDate(date);
        setEditAppointmentTime("");
        setAppointmentEditError("");
        setShowEditMonthCalendar(false);
    }

    function moveEditAppointmentWeek(amount: number) {
        const currentWeek = getManualWeekDates(editWeekReferenceDate);
        const nextReference = addDaysToInputDate(currentWeek[0], amount * 7);
        const nextWeek = getManualWeekDates(nextReference);
        const today = formatDateForInput(new Date());
        const firstSelectable = nextWeek.find((date) => date >= today);

        setEditWeekReferenceDate(nextReference);
        setEditAppointmentTime("");
        setAppointmentEditError("");

        if (firstSelectable) {
            setEditAppointmentDate(firstSelectable);
        }
    }

    function openEditAppointmentMonthCalendar() {
        const reference = new Date(
            `${editAppointmentDate || editWeekReferenceDate}T12:00:00`,
        );

        setEditCalendarMonth(
            new Date(reference.getFullYear(), reference.getMonth(), 1),
        );
        setShowEditMonthCalendar((current) => !current);
    }

    function getEditAppointmentMonthCells() {
        const year = editCalendarMonth.getFullYear();
        const month = editCalendarMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = firstDay.getDay();
        const leadingEmpty = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

        return [
            ...Array.from({length: leadingEmpty}, () => null),
            ...Array.from({length: daysInMonth}, (_, index) =>
                formatDateForInput(new Date(year, month, index + 1)),
            ),
        ];
    }

    const editSelectedService = adminServices.find(
        (service) => service.name === editAppointmentService,
    );

    const editAppointmentAvailableTimes = useMemo(() => {
        if (
            !selectedAdminAppointment ||
            !editAppointmentDate ||
            !editSelectedService
        ) {
            return [] as string[];
        }

        const candidateStarts =
            getFixedAdminManualStartMinutes(editAppointmentDate);

        const occupied: TimeInterval[] = [
            ...appointments
                .filter(
                    (appointment) =>
                        appointment.id !== selectedAdminAppointment.id &&
                        appointment.appointment_date === editAppointmentDate &&
                        appointment.status !== "cancelled" &&
                        appointment.status !== "no-show",
                )
                .map((appointment) => {
                    const start = getMinutesFromTime(appointment.start_time);

                    return {
                        start,
                        end: start + appointment.duration_minutes,
                    };
                }),
            ...adminBlocks
                .filter((block) => block.block_date === editAppointmentDate)
                .map((block) => ({
                    start: getMinutesFromTime(block.start_time),
                    end: getMinutesFromTime(block.end_time),
                })),
        ];

        const merged = mergeIntervals(occupied);
        const now = new Date();
        const today = formatDateForInput(now);
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        return candidateStarts
            .filter((start) => {
                const end = start + editSelectedService.duration_minutes;
                const isPastToday =
                    editAppointmentDate === today &&
                    start <= currentMinutes;

                const hasConflict = merged.some((interval) =>
                    intervalsOverlap(
                        start,
                        end,
                        interval.start,
                        interval.end,
                    ),
                );

                return !isPastToday && !hasConflict;
            })
            .map(minutesToTime);
    }, [
        selectedAdminAppointment,
        editAppointmentDate,
        editSelectedService,
        appointments,
        adminBlocks,
    ]);

    async function saveAppointmentChanges() {
        if (!selectedAdminAppointment) return;
        const service = adminServices.find((item) => item.name === editAppointmentService);
        if (!service) {
            setAppointmentEditError("Escolha um serviço válido.");
            return;
        }

        if (!editAppointmentDate || !editAppointmentTime) {
            setAppointmentEditError("Escolha a nova data e o horário.");
            return;
        }
        if (editAppointmentName.trim().length < 3 || editAppointmentPhone.replace(/\D/g, "").length < 10) {
            setAppointmentEditError("Informe nome completo e telefone válido.");
            return;
        }
        if (appointmentConflicts(selectedAdminAppointment.id, editAppointmentDate, editAppointmentTime, service.duration_minutes)) {
            setAppointmentEditError("O novo período entra em conflito com outro agendamento ou bloqueio.");
            return;
        }

        setIsSavingAppointment(true);
        const updates = {
            client_name: editAppointmentName.trim(),
            client_phone: formatBrazilianPhone(editAppointmentPhone),
            client_email: editAppointmentEmail.trim() || null,
            musical_taste: editAppointmentMusicTaste.trim() || null,
            service_name: service.name,
            appointment_date: editAppointmentDate,
            start_time: editAppointmentTime,
            duration_minutes: service.duration_minutes,
        };
        const {error} = await supabase.from("appointments").update(updates).eq("id", selectedAdminAppointment.id);
        if (error) {
            console.error("Erro ao editar agendamento:", error);
            setAppointmentEditError("Não foi possível salvar as alterações.");
            setIsSavingAppointment(false);
            return;
        }

        const updated = {...selectedAdminAppointment, ...updates};
        setAppointments((current) => current.map((item) => item.id === updated.id ? updated : item));
        setSelectedAdminAppointment(updated);
        setAgendaDate(editAppointmentDate);
        setIsSavingAppointment(false);
        setAppointmentEditError("");
    }

    async function cancelAppointment(appointment: AdminAppointment) {
        if (!window.confirm(`Cancelar o agendamento de ${appointment.client_name}?`)) return;
        const {error} = await supabase.from("appointments").update({status: "cancelled"}).eq("id", appointment.id);
        if (error) {
            setPanelError("Não foi possível cancelar o agendamento.");
            return;
        }
        setAppointments((current) => current.map((item) => item.id === appointment.id ? {...item, status: "cancelled"} : item));
        setSelectedAdminAppointment(null);
    }

    async function clearCancelledAppointmentFromHistory(
        appointment: AdminAppointment,
    ) {
        if (appointment.status !== "cancelled") return;

        const confirmed = window.confirm(
            `Limpar do histórico o agendamento cancelado de ${formatAdminDate(
                appointment.appointment_date,
            )} às ${String(appointment.start_time).slice(0, 5)}?`,
        );

        if (!confirmed) return;

        setClearingCancelledAppointmentId(appointment.id);
        setPanelError("");

        try {
            const {error} = await supabase
                .from("appointments")
                .delete()
                .eq("id", appointment.id)
                .eq("status", "cancelled");

            if (error) {
                throw error;
            }

            setAppointments((current) =>
                current.filter((item) => item.id !== appointment.id),
            );

            setSelectedClient((current) =>
                current
                    ? {
                        ...current,
                        appointments: current.appointments.filter(
                            (item) => item.id !== appointment.id,
                        ),
                    }
                    : current,
            );
        } catch (error) {
            console.error(
                "Erro ao limpar agendamento cancelado do histórico:",
                error,
            );
            setPanelError(
                "Não foi possível limpar o agendamento cancelado do histórico.",
            );
        } finally {
            setClearingCancelledAppointmentId(null);
        }
    }

    function normalizeClientPhone(value: string) {
        return normalizeBrazilianPhoneDigits(value);
    }

    function resetNailRecordForm() {
        setShowNailRecordForm(false);
        setNailRecordNotes("");
        setNailRecordFiles([]);
        setNailRecordError("");
        setNailRecordSuccess("");
    }

    function openClientHistory(client: AdminClient) {
        resetNailRecordForm();
        setNailRecords([]);
        setSelectedClient(client);
    }

    function openNailRecordForClient(client: AdminClient) {
        resetNailRecordForm();
        setNailRecords([]);
        setSelectedClient(client);
        setShowNailRecordForm(true);
    }

    function closeClientHistory() {
        resetNailRecordForm();
        setNailRecords([]);
        setSelectedClient(null);
    }

    async function findClientProfile(client: AdminClient): Promise<ClientProfile | null> {
        const {data, error} = await supabase
            .from("client_profiles")
            .select("id, full_name, phone, email, musical_taste, created_at, updated_at");

        if (error) {
            throw error;
        }

        const clientPhoneDigits = normalizeClientPhone(client.phone);

        if (clientPhoneDigits) {
            const matchedByPhone =
                (data ?? []).find(
                    (profile) =>
                        normalizeClientPhone(profile.phone ?? "") === clientPhoneDigits,
                ) ?? null;

            if (matchedByPhone) {
                return matchedByPhone;
            }
        }

        return null;
    }

    async function ensureClientProfile(client: AdminClient): Promise<ClientProfile> {
        const existingProfile = await findClientProfile(client);

        if (existingProfile) {
            const updates = {
                full_name: client.name.trim(),
                phone: client.phone.trim(),
                email: client.email.trim() || null,
                musical_taste: client.musicalTaste.trim() || null,
                updated_at: new Date().toISOString(),
            };

            const {data: updatedProfile, error: updateError} = await supabase
                .from("client_profiles")
                .update(updates)
                .eq("id", existingProfile.id)
                .select("id, full_name, phone, email, musical_taste, created_at, updated_at")
                .single();

            if (updateError) {
                throw updateError;
            }

            return updatedProfile as ClientProfile;
        }

        const {data, error} = await supabase
            .from("client_profiles")
            .insert({
                full_name: client.name.trim(),
                phone: client.phone.trim(),
                email: client.email.trim() || null,
                musical_taste: client.musicalTaste.trim() || null,
            })
            .select("id, full_name, phone, email, musical_taste, created_at, updated_at")
            .single();

        if (error) {
            throw error;
        }

        return data as ClientProfile;
    }

    async function loadNailRecordsForClient(client: AdminClient) {
        setIsLoadingNailRecords(true);
        setNailRecordError("");

        try {
            const profile = await findClientProfile(client);

            if (!profile) {
                setNailRecords([]);
                return;
            }

            const {data: recordData, error: recordError} = await supabase
                .from("nail_records")
                .select("id, client_id, notes, created_at")
                .eq("client_id", profile.id)
                .order("created_at", {ascending: false});

            if (recordError) {
                throw recordError;
            }

            const records = (recordData ?? []) as Omit<NailRecord, "photos">[];

            if (!records.length) {
                setNailRecords([]);
                return;
            }

            const recordIds = records.map((record) => record.id);

            const {data: photoData, error: photoError} = await supabase
                .from("nail_record_photos")
                .select("id, nail_record_id, photo_path, created_at")
                .in("nail_record_id", recordIds)
                .order("created_at", {ascending: true});

            if (photoError) {
                throw photoError;
            }

            const photosWithSignedUrls = await Promise.all(
                ((photoData ?? []) as NailRecordPhoto[]).map(async (photo) => {
                    const {data: signedData, error: signedError} = await supabase
                        .storage
                        .from("nail-records")
                        .createSignedUrl(photo.photo_path, 60 * 60);

                    if (signedError) {
                        console.error("Erro ao gerar URL temporária da foto:", signedError);
                        return photo;
                    }

                    return {
                        ...photo,
                        signedUrl: signedData.signedUrl,
                    };
                }),
            );

            setNailRecords(
                records.map((record) => ({
                    ...record,
                    photos: photosWithSignedUrls.filter(
                        (photo) => photo.nail_record_id === record.id,
                    ),
                })),
            );
        } catch (error) {
            console.error("Erro ao carregar registros das unhas:", error);
            setNailRecordError("Não foi possível carregar os registros das unhas.");
            setNailRecords([]);
        } finally {
            setIsLoadingNailRecords(false);
        }
    }

    function handleNailCameraSelection(event: React.ChangeEvent<HTMLInputElement>) {
        const selectedFiles = Array.from(event.target.files ?? [])
            .filter((file) => file.type.startsWith("image/"));

        if (!selectedFiles.length) {
            event.currentTarget.value = "";
            return;
        }

        const oversizedFile = selectedFiles.find(
            (file) => file.size > 12 * 1024 * 1024,
        );

        if (oversizedFile) {
            setNailRecordError("Cada foto pode ter no máximo 12 MB.");
            event.currentTarget.value = "";
            return;
        }

        setNailRecordError("");
        setNailRecordSuccess("");
        setNailRecordFiles((current) => [...current, ...selectedFiles].slice(0, 6));
        event.currentTarget.value = "";
    }

    function removeNailRecordFile(index: number) {
        setNailRecordFiles((current) =>
            current.filter((_, currentIndex) => currentIndex !== index),
        );
    }

    async function saveNailRecord() {
        if (!selectedClient) {
            return;
        }

        setNailRecordError("");
        setNailRecordSuccess("");

        if (!nailRecordFiles.length) {
            setNailRecordError("Tire pelo menos uma foto da unha antes de salvar.");
            return;
        }

        setIsSavingNailRecord(true);

        let createdRecordId: string | null = null;
        const uploadedPaths: string[] = [];

        try {
            const profile = await ensureClientProfile(selectedClient);

            const {data: recordData, error: recordError} = await supabase
                .from("nail_records")
                .insert({
                    client_id: profile.id,
                    notes: nailRecordNotes.trim() || null,
                })
                .select("id, client_id, notes, created_at")
                .single();

            if (recordError || !recordData) {
                throw recordError ?? new Error("Não foi possível criar o registro.");
            }

            createdRecordId = recordData.id;

            const photoRows: Array<{
                nail_record_id: string;
                photo_path: string;
            }> = [];

            for (let index = 0; index < nailRecordFiles.length; index += 1) {
                const file = nailRecordFiles[index];
                const originalExtension = file.name.includes(".")
                    ? file.name.split(".").pop()?.toLowerCase()
                    : "";
                const safeExtension = originalExtension?.replace(/[^a-z0-9]/g, "") || "jpg";
                const uniqueId =
                    typeof crypto !== "undefined" && "randomUUID" in crypto
                        ? crypto.randomUUID()
                        : `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`;

                const photoPath =
                    `${profile.id}/${recordData.id}/${uniqueId}.${safeExtension}`;

                const {error: uploadError} = await supabase
                    .storage
                    .from("nail-records")
                    .upload(photoPath, file, {
                        cacheControl: "3600",
                        upsert: false,
                        contentType: file.type || "image/jpeg",
                    });

                if (uploadError) {
                    throw uploadError;
                }

                uploadedPaths.push(photoPath);
                photoRows.push({
                    nail_record_id: recordData.id,
                    photo_path: photoPath,
                });
            }

            const {error: photoInsertError} = await supabase
                .from("nail_record_photos")
                .insert(photoRows);

            if (photoInsertError) {
                throw photoInsertError;
            }

            setNailRecordNotes("");
            setNailRecordFiles([]);
            setShowNailRecordForm(false);
            setNailRecordSuccess("Registro da unha salvo com sucesso.");

            await loadNailRecordsForClient(selectedClient);
        } catch (error) {
            console.error("Erro ao salvar registro da unha:", error);

            if (uploadedPaths.length) {
                await supabase.storage.from("nail-records").remove(uploadedPaths);
            }

            if (createdRecordId) {
                await supabase
                    .from("nail_records")
                    .delete()
                    .eq("id", createdRecordId);
            }

            setNailRecordError(
                "Não foi possível salvar o registro. Confira a conexão e tente novamente.",
            );
        } finally {
            setIsSavingNailRecord(false);
        }
    }

    async function deleteNailRecord(record: NailRecord) {
        if (!selectedClient || deletingNailRecordId) {
            return;
        }

        const confirmed = window.confirm(
            "Deseja realmente excluir este registro da unha? As fotos e observações deste registro serão apagadas permanentemente.",
        );

        if (!confirmed) {
            return;
        }

        setDeletingNailRecordId(record.id);
        setNailRecordError("");
        setNailRecordSuccess("");

        try {
            const photoPaths = record.photos
                .map((photo) => photo.photo_path)
                .filter(Boolean);

            if (photoPaths.length) {
                const {error: storageError} = await supabase
                    .storage
                    .from("nail-records")
                    .remove(photoPaths);

                if (storageError) {
                    throw storageError;
                }
            }

            const {error: photoDeleteError} = await supabase
                .from("nail_record_photos")
                .delete()
                .eq("nail_record_id", record.id);

            if (photoDeleteError) {
                throw photoDeleteError;
            }

            const {error: recordDeleteError} = await supabase
                .from("nail_records")
                .delete()
                .eq("id", record.id);

            if (recordDeleteError) {
                throw recordDeleteError;
            }

            setNailRecords((current) =>
                current.filter((item) => item.id !== record.id),
            );
            setNailRecordSuccess("Registro da unha excluído com sucesso.");
        } catch (error) {
            console.error("Erro ao excluir registro da unha:", error);
            setNailRecordError(
                "Não foi possível excluir o registro da unha. Tente novamente.",
            );
        } finally {
            setDeletingNailRecordId(null);
        }
    }

    useEffect(() => {
        if (!isAuthenticated || !selectedClient) {
            setNailRecords([]);
            setIsLoadingNailRecords(false);
            return;
        }

        void loadNailRecordsForClient(selectedClient);
    }, [isAuthenticated, selectedClient?.key]);

    const clients = useMemo<AdminClient[]>(() => {
        type ClientGroup = {
            key: string;
            profile: ClientProfile | null;
            appointments: AdminAppointment[];
        };

        const groups = new Map<string, ClientGroup>();
        const profileIdToKey = new Map<string, string>();
        const phoneToKey = new Map<string, string>();

        /*
         * client_profiles é a fonte principal da lista.
         * Assim, uma cliente aparece no painel imediatamente após criar a conta,
         * mesmo que ainda não tenha nenhum agendamento.
         */
        adminClientProfiles.forEach((profile) => {
            const digits = normalizeClientPhone(profile.phone ?? "");
            const key = `profile:${profile.id}`;

            groups.set(key, {
                key,
                profile,
                appointments: [],
            });

            profileIdToKey.set(profile.id, key);

            if (digits) {
                phoneToKey.set(digits, key);
            }
        });

        /*
         * Os agendamentos são anexados ao perfil existente pelo client_id.
         * Para registros antigos sem client_id, usamos o telefone como fallback.
         * Só criamos um grupo legado quando realmente não existe perfil correspondente.
         */
        appointments.forEach((appointment) => {
            const digits = normalizeClientPhone(appointment.client_phone);
            const profileKey = appointment.client_id
                ? profileIdToKey.get(appointment.client_id)
                : undefined;
            const phoneKey = digits ? phoneToKey.get(digits) : undefined;
            const key =
                profileKey ??
                phoneKey ??
                `legacy:${digits || appointment.id}`;

            const existing = groups.get(key);

            if (existing) {
                existing.appointments.push(appointment);
                return;
            }

            groups.set(key, {
                key,
                profile: null,
                appointments: [appointment],
            });

            if (digits) {
                phoneToKey.set(digits, key);
            }
        });

        return Array.from(groups.values())
            .map((group): AdminClient | null => {
                /*
                 * Preserva a função "Remover da lista":
                 * se a cliente possui agendamentos e todos foram marcados como ocultos,
                 * ela continua escondida. Perfil recém-cadastrado, sem agendamentos,
                 * aparece normalmente.
                 */
                const visibleAppointments = group.appointments.filter(
                    (appointment) => !appointment.client_hidden,
                );

                if (
                    group.appointments.length > 0 &&
                    visibleAppointments.length === 0
                ) {
                    return null;
                }

                const ordered = [...visibleAppointments].sort(
                    (a, b) =>
                        getAppointmentDateTime(b).getTime() -
                        getAppointmentDateTime(a).getTime(),
                );

                const reference = ordered[0] ?? null;

                const completed = ordered.filter(
                    (item) =>
                        item.status !== "cancelled" &&
                        item.status !== "no-show" &&
                        (
                            item.status === "completed" ||
                            getAppointmentEndDateTime(item).getTime() <=
                            adminNow.getTime()
                        ),
                );

                const upcoming = ordered
                    .filter(
                        (item) =>
                            item.status !== "cancelled" &&
                            item.status !== "no-show" &&
                            item.status !== "completed" &&
                            getAppointmentEndDateTime(item).getTime() >
                            adminNow.getTime(),
                    )
                    .sort(
                        (a, b) =>
                            getAppointmentDateTime(a).getTime() -
                            getAppointmentDateTime(b).getTime(),
                    );

                const profile = group.profile;

                return {
                    key: group.key,
                    name:
                        profile?.full_name ??
                        reference?.client_name ??
                        "Cliente",
                    phone:
                        profile?.phone ??
                        reference?.client_phone ??
                        "",
                    email:
                        profile?.email ??
                        reference?.client_email ??
                        "",
                    musicalTaste:
                        profile?.musical_taste ??
                        reference?.musical_taste ??
                        "",
                    appointments: ordered,
                    lastAppointment: completed[0] ?? null,
                    nextAppointment: upcoming[0] ?? null,
                };
            })
            .filter((client): client is AdminClient => client !== null)
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }, [appointments, adminClientProfiles, adminNow]);

    const filteredClients = useMemo(() => {
        const query = clientSearch
            .trim()
            .toLocaleLowerCase("pt-BR");
        const digits = clientSearch.replace(/\D/g, "");

        if (!query) return clients;

        return clients.filter((client) => {
            const normalizedName = client.name
                .trim()
                .toLocaleLowerCase("pt-BR");

            const clientPhoneDigits = client.phone.replace(/\D/g, "");

            const matchesName = normalizedName.startsWith(query);
            const matchesPhone =
                Boolean(digits) &&
                clientPhoneDigits.includes(digits);

            return matchesName || matchesPhone;
        });
    }, [clients, clientSearch]);

    const manualBookingClients = useMemo<AdminBookingClient[]>(() => {
        const byPhone = new Map<string, AdminBookingClient>();

        adminClientProfiles.forEach((profile) => {
            const digits = normalizeClientPhone(profile.phone ?? "");
            const key = digits || `profile:${profile.id}`;
            byPhone.set(key, {
                key,
                profileId: profile.id,
                name: profile.full_name,
                phone: profile.phone,
                email: profile.email ?? "",
                userId: profile.user_id ?? null,
            });
        });

        clients.forEach((client) => {
            const digits = normalizeClientPhone(client.phone);
            const key = digits || `client:${client.key}`;
            if (!byPhone.has(key)) {
                byPhone.set(key, {
                    key,
                    profileId: null,
                    name: client.name,
                    phone: client.phone,
                    email: client.email,
                });
            }
        });

        return Array.from(byPhone.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }, [adminClientProfiles, clients]);

    const filteredManualBookingClients = useMemo(() => {
        const query = manualClientSearch
            .trim()
            .toLocaleLowerCase("pt-BR");
        const digits = manualClientSearch.replace(/\D/g, "");

        if (!query) return [] as AdminBookingClient[];

        return manualBookingClients
            .filter((client) => {
                const normalizedName = client.name
                    .trim()
                    .toLocaleLowerCase("pt-BR");

                const clientPhoneDigits = client.phone.replace(/\D/g, "");

                const matchesName = normalizedName.startsWith(query);
                const matchesPhone =
                    Boolean(digits) &&
                    clientPhoneDigits.includes(digits);

                return matchesName || matchesPhone;
            })
            .slice(0, 8);
    }, [manualBookingClients, manualClientSearch]);

    function getManualWeekDates(referenceDate: string) {
        const reference = new Date(`${referenceDate}T12:00:00`);
        const day = reference.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        reference.setDate(reference.getDate() + diffToMonday);

        return Array.from({length: 7}, (_, index) => {
            const date = new Date(reference);
            date.setDate(reference.getDate() + index);
            return formatDateForInput(date);
        });
    }

    const manualVisibleWeekDates = useMemo(
        () => getManualWeekDates(manualWeekReferenceDate),
        [manualWeekReferenceDate],
    );

    function selectManualBookingDate(date: string) {
        const today = formatDateForInput(new Date());
        if (date < today) return;

        setManualDate(date);
        setManualWeekReferenceDate(date);
        setManualTime("");
        setManualError("");
        setShowManualMonthCalendar(false);
    }

    function moveManualBookingWeek(amount: number) {
        const currentWeek = getManualWeekDates(manualWeekReferenceDate);
        const nextReference = addDaysToInputDate(currentWeek[0], amount * 7);
        const nextWeek = getManualWeekDates(nextReference);
        const today = formatDateForInput(new Date());
        const firstSelectable = nextWeek.find((date) => date >= today);

        setManualWeekReferenceDate(nextReference);
        setManualTime("");
        setManualError("");

        if (firstSelectable) {
            setManualDate(firstSelectable);
        }
    }

    function openManualMonthCalendar() {
        const reference = new Date(`${manualDate || manualWeekReferenceDate}T12:00:00`);
        setManualCalendarMonth(new Date(reference.getFullYear(), reference.getMonth(), 1));
        setShowManualMonthCalendar((current) => !current);
    }

    function getManualMonthCalendarCells() {
        const year = manualCalendarMonth.getFullYear();
        const month = manualCalendarMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = firstDay.getDay();
        const leadingEmpty = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

        return [
            ...Array.from({length: leadingEmpty}, () => null),
            ...Array.from({length: daysInMonth}, (_, index) =>
                formatDateForInput(new Date(year, month, index + 1)),
            ),
        ];
    }

    const manualSelectedService = adminServices.find((service) => service.name === manualServiceName);

    const manualAvailableTimes = useMemo(() => {
        if (!manualDate || !manualSelectedService) return [] as string[];

        const candidateStarts = getFixedAdminManualStartMinutes(manualDate);

        const occupied: TimeInterval[] = [
            ...appointments
                .filter((appointment) =>
                    appointment.appointment_date === manualDate &&
                    appointment.status !== "cancelled" &&
                    appointment.status !== "no-show",
                )
                .map((appointment) => {
                    const start = getMinutesFromTime(appointment.start_time);
                    return {start, end: start + appointment.duration_minutes};
                }),
            ...adminBlocks
                .filter((block) => block.block_date === manualDate)
                .map((block) => ({
                    start: getMinutesFromTime(block.start_time),
                    end: getMinutesFromTime(block.end_time),
                })),
        ];

        const merged = mergeIntervals(occupied);
        const now = new Date();
        const today = formatDateForInput(now);
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        return candidateStarts
            .filter((start) => {
                const end = start + manualSelectedService.duration_minutes;
                const isPastToday = manualDate === today && start <= currentMinutes;
                const hasConflict = merged.some((occupiedInterval) =>
                    intervalsOverlap(
                        start,
                        end,
                        occupiedInterval.start,
                        occupiedInterval.end,
                    ),
                );

                return !isPastToday && !hasConflict;
            })
            .map(minutesToTime);
    }, [
        manualDate,
        manualSelectedService,
        appointments,
        adminBlocks,
    ]);

    function formatBirthDateForDisplay(value: string | null | undefined) {
        if (!value) return "";

        const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!isoMatch) return value;

        return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    function formatBirthDateForDatabase(value: string) {
        const trimmed = value.trim();
        if (!trimmed) return null;

        const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (brMatch) {
            return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
        }

        return trimmed;
    }

    function updateClientAnamnesisField(
        field: keyof ClientAnamnesisForm,
        value: string,
    ) {
        setClientAnamnesis((current) => ({
            ...current,
            [field]: value,
        }));
    }

    async function loadClientAnamnesis(profileId: string) {
        setIsLoadingClientAnamnesis(true);

        const {data, error} = await supabase
            .from("client_anamnesis")
            .select(
                "birth_date, referral, pregnant, diabetes, bariatric, chemotherapy, thyroid, nail_biting, allergies, mycosis, continuous_medication, cleaning_products",
            )
            .eq("client_id", profileId)
            .maybeSingle();

        if (error) {
            console.error("Erro ao carregar ficha de anamnese:", error);
            setClientAnamnesis(emptyClientAnamnesis);
            setIsLoadingClientAnamnesis(false);
            return;
        }

        setClientAnamnesis({
            birthDate: formatBirthDateForDisplay(data?.birth_date),
            referral: data?.referral ?? "",
            pregnant: data?.pregnant ?? "",
            diabetes: data?.diabetes ?? "",
            bariatric: data?.bariatric ?? "",
            chemotherapy: data?.chemotherapy ?? "",
            thyroid: data?.thyroid ?? "",
            nailBiting: data?.nail_biting ?? "",
            allergies: data?.allergies ?? "",
            mycosis: data?.mycosis ?? "",
            continuousMedication: data?.continuous_medication ?? "",
            cleaningProducts: data?.cleaning_products ?? "",
        });

        setIsLoadingClientAnamnesis(false);
    }

    async function openClientEditor(client: AdminClient) {
        setEditingClient(client);
        setEditClientName(client.name);
        setEditClientPhone(client.phone);
        setEditClientEmail(client.email);
        setClientAnamnesis(emptyClientAnamnesis);

        const phoneDigits = normalizeClientPhone(client.phone);
        const profile = adminClientProfiles.find(
            (item) => normalizeClientPhone(item.phone ?? "") === phoneDigits,
        );

        setEditClientMusicTaste(
            profile?.musical_taste ?? client.musicalTaste ?? "",
        );
        setClientEditError("");

        if (profile?.id) {
            await loadClientAnamnesis(profile.id);
        }
    }

    async function saveClientChanges() {
        if (!editingClient) return;

        if (
            editClientName.trim().length < 3 ||
            editClientPhone.replace(/\D/g, "").length < 10
        ) {
            setClientEditError("Informe nome completo e telefone válido.");
            return;
        }

        setIsSavingClient(true);
        setClientEditError("");

        const ids = editingClient.appointments.map((item) => item.id);
        const normalizedPhone = formatBrazilianPhone(editClientPhone);
        const musicalTaste = editClientMusicTaste.trim() || null;

        try {
            if (ids.length) {
                const {error: appointmentError} = await supabase
                    .from("appointments")
                    .update({
                        client_name: editClientName.trim(),
                        client_phone: normalizedPhone,
                        client_email: editClientEmail.trim() || null,
                        musical_taste: musicalTaste,
                    })
                    .in("id", ids);

                if (appointmentError) throw appointmentError;
            }

            const existingProfile = await findClientProfile(editingClient);

            if (existingProfile) {
                const {data: updatedProfile, error: profileError} = await supabase
                    .from("client_profiles")
                    .update({
                        full_name: editClientName.trim(),
                        phone: normalizedPhone,
                        email: editClientEmail.trim() || null,
                        musical_taste: musicalTaste,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", existingProfile.id)
                    .select(
                        "id, full_name, phone, email, musical_taste, phone_digits, user_id, created_at, updated_at",
                    )
                    .single();

                if (profileError) throw profileError;

                setAdminClientProfiles((current) =>
                    current.map((profile) =>
                        profile.id === existingProfile.id
                            ? updatedProfile as ClientProfile
                            : profile,
                    ),
                );
            }

            if (existingProfile) {
                const {error: anamnesisError} = await supabase
                    .from("client_anamnesis")
                    .upsert(
                        {
                            client_id: existingProfile.id,
                            birth_date: formatBirthDateForDatabase(
                                clientAnamnesis.birthDate,
                            ),
                            referral: clientAnamnesis.referral.trim() || null,
                            pregnant: clientAnamnesis.pregnant.trim() || null,
                            diabetes: clientAnamnesis.diabetes.trim() || null,
                            bariatric: clientAnamnesis.bariatric.trim() || null,
                            chemotherapy: clientAnamnesis.chemotherapy.trim() || null,
                            thyroid: clientAnamnesis.thyroid.trim() || null,
                            nail_biting: clientAnamnesis.nailBiting.trim() || null,
                            allergies: clientAnamnesis.allergies.trim() || null,
                            mycosis: clientAnamnesis.mycosis.trim() || null,
                            continuous_medication:
                                clientAnamnesis.continuousMedication.trim() || null,
                            cleaning_products:
                                clientAnamnesis.cleaningProducts.trim() || null,
                            updated_at: new Date().toISOString(),
                        },
                        {
                            onConflict: "client_id",
                        },
                    );

                if (anamnesisError) {
                    throw anamnesisError;
                }
            }

            setAppointments((current) =>
                current.map((item) =>
                    ids.includes(item.id)
                        ? {
                            ...item,
                            client_name: editClientName.trim(),
                            client_phone: normalizedPhone,
                            client_email: editClientEmail.trim() || null,
                            musical_taste: musicalTaste,
                        }
                        : item,
                ),
            );

            setEditingClient(null);
        } catch (error) {
            console.error("Erro ao atualizar cadastro da cliente:", error);
            setClientEditError("Não foi possível atualizar o cadastro.");
        } finally {
            setIsSavingClient(false);
        }
    }

    async function deleteClient(client: AdminClient) {
        if (!window.confirm(`Remover ${client.name} da lista de clientes? O histórico financeiro e os agendamentos serão preservados.`)) return;

        const appointmentIds = client.appointments.map((appointment) => appointment.id);

        if (!appointmentIds.length) {
            setSelectedClient(null);
            return;
        }

        setDeletingClientKey(client.key);
        setPanelError("");

        try {
            const {error} = await supabase
                .from("appointments")
                .update({client_hidden: true})
                .in("id", appointmentIds);

            if (error) {
                throw error;
            }

            setAppointments((current) =>
                current.map((appointment) =>
                    appointmentIds.includes(appointment.id)
                        ? {...appointment, client_hidden: true}
                        : appointment,
                ),
            );

            setSelectedClient(null);
        } catch (error) {
            console.error("Erro ao remover cliente da lista:", error);
            setPanelError("Não foi possível remover a cliente da lista.");
        } finally {
            setDeletingClientKey("");
        }
    }

    const weekDates = useMemo(() => {
        const selected = new Date(`${agendaDate}T12:00:00`);
        const mondayOffset = selected.getDay() === 0 ? -6 : 1 - selected.getDay();
        const monday = addDaysToInputDate(agendaDate, mondayOffset);
        return Array.from({length: 7}, (_, index) => addDaysToInputDate(monday, index));
    }, [agendaDate]);

    const agendaVisibleWeekDates = useMemo(
        () => getManualWeekDates(agendaWeekReferenceDate),
        [agendaWeekReferenceDate],
    );

    function selectAgendaPickerDate(date: string) {
        setAgendaDate(date);
        setAgendaWeekReferenceDate(date);
        setShowAgendaMonthCalendar(false);
        setShowAgendaDatePicker(false);
    }

    function moveAgendaPickerWeek(amount: number) {
        const currentWeek = getManualWeekDates(agendaWeekReferenceDate);
        const nextReference = addDaysToInputDate(currentWeek[0], amount * 7);

        setAgendaWeekReferenceDate(nextReference);
        setShowAgendaMonthCalendar(false);
    }

    function openAgendaMonthCalendar() {
        const reference = new Date(`${agendaDate || agendaWeekReferenceDate}T12:00:00`);
        setAgendaCalendarMonth(
            new Date(reference.getFullYear(), reference.getMonth(), 1),
        );
        setShowAgendaMonthCalendar((current) => !current);
    }

    function getAgendaMonthCalendarCells() {
        const year = agendaCalendarMonth.getFullYear();
        const month = agendaCalendarMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = firstDay.getDay();
        const leadingEmpty = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

        return [
            ...Array.from({ length: leadingEmpty }, () => null),
            ...Array.from({ length: daysInMonth }, (_, index) =>
                formatDateForInput(new Date(year, month, index + 1)),
            ),
        ];
    }

    const agendaPickerMonthLabel = useMemo(() => {
        const reference = new Date(`${agendaWeekReferenceDate}T12:00:00`);
        return reference.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
        });
    }, [agendaWeekReferenceDate]);

    function shouldShowAppointmentInAdminAgenda(appointment: AdminAppointment) {
        if (
            appointment.status === "cancelled" ||
            appointment.status === "completed" ||
            appointment.status === "no-show"
        ) {
            return false;
        }

        return getAppointmentDateTime(appointment).getTime() > adminNow.getTime();
    }

    const agendaAppointments = useMemo(() =>
            appointments
                .filter(
                    (item) =>
                        item.appointment_date === agendaDate &&
                        shouldShowAppointmentInAdminAgenda(item),
                )
                .sort((a, b) => getMinutesFromTime(a.start_time) - getMinutesFromTime(b.start_time)),
        [appointments, agendaDate, adminNow]);

    const weeklyAppointments = useMemo(() =>
            appointments
                .filter(
                    (item) =>
                        weekDates.includes(item.appointment_date) &&
                        shouldShowAppointmentInAdminAgenda(item),
                )
                .sort((a, b) => `${a.appointment_date}${String(a.start_time).slice(0, 5)}`.localeCompare(`${b.appointment_date}${String(b.start_time).slice(0, 5)}`)),
        [appointments, weekDates, adminNow]);

    function addMonthsToFinanceMonth(monthValue: string, amount: number) {
        const [year, month] = monthValue.split("-").map(Number);
        const date = new Date(year, month - 1 + amount, 1, 12, 0, 0);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }

    const financeMonthLabel = useMemo(() => {
        const [year, month] = financeMonth.split("-").map(Number);
        return new Date(year, month - 1, 1, 12, 0, 0).toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
        });
    }, [financeMonth]);

    const financeMonthOptions = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
    ];

    function selectFinanceMonth(monthIndex: number) {
        const month = String(monthIndex + 1).padStart(2, "0");
        setFinanceMonth(`${financePickerYear}-${month}`);
        setShowFinanceMonthPicker(false);
    }

    function openFinanceMonthPicker() {
        const [year] = financeMonth.split("-").map(Number);
        setFinancePickerYear(year);
        setShowFinanceMonthPicker((current) => !current);
    }

    function selectCurrentFinanceMonth() {
        const now = new Date();
        setFinanceMonth(
            `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        );
        setFinancePickerYear(now.getFullYear());
        setShowFinanceMonthPicker(false);
    }

    const financeAppointments = useMemo(
        () => appointments.filter((appointment) => appointment.appointment_date.startsWith(financeMonth)),
        [appointments, financeMonth],
    );

    const completedFinanceAppointments = useMemo(
        () => financeAppointments.filter(
            (appointment) =>
                appointment.status !== "cancelled" &&
                appointment.status !== "no-show" &&
                (
                    appointment.status === "completed" ||
                    getAppointmentDateTime(appointment).getTime() <= adminNow.getTime()
                ),
        ),
        [financeAppointments, adminNow],
    );

    const scheduledFinanceAppointments = useMemo(
        () => financeAppointments.filter(
            (appointment) =>
                appointment.status !== "cancelled" &&
                appointment.status !== "no-show" &&
                appointment.status !== "completed" &&
                getAppointmentDateTime(appointment).getTime() > adminNow.getTime(),
        ),
        [financeAppointments, adminNow],
    );

    const completedRevenueCents = useMemo(
        () => completedFinanceAppointments.reduce((total, appointment) => total + (appointment.price_cents ?? 0), 0),
        [completedFinanceAppointments],
    );

    const scheduledRevenueCents = useMemo(
        () => scheduledFinanceAppointments.reduce((total, appointment) => total + (appointment.price_cents ?? 0), 0),
        [scheduledFinanceAppointments],
    );

    const forecastRevenueCents = completedRevenueCents + scheduledRevenueCents;

    const financeServiceSummary = useMemo(() => {
        const summary = new Map<string, {
            serviceName: string;
            completedCount: number;
            completedCents: number;
            scheduledCount: number;
            scheduledCents: number;
        }>();

        [...completedFinanceAppointments, ...scheduledFinanceAppointments].forEach((appointment) => {
            const current = summary.get(appointment.service_name) ?? {
                serviceName: appointment.service_name,
                completedCount: 0,
                completedCents: 0,
                scheduledCount: 0,
                scheduledCents: 0,
            };

            const isAutomaticallyCompleted =
                appointment.status === "completed" ||
                getAppointmentDateTime(appointment).getTime() <= adminNow.getTime();

            if (isAutomaticallyCompleted) {
                current.completedCount += 1;
                current.completedCents += appointment.price_cents ?? 0;
            } else {
                current.scheduledCount += 1;
                current.scheduledCents += appointment.price_cents ?? 0;
            }

            summary.set(appointment.service_name, current);
        });

        return Array.from(summary.values()).sort(
            (a, b) => (b.completedCents + b.scheduledCents) - (a.completedCents + a.scheduledCents),
        );
    }, [completedFinanceAppointments, scheduledFinanceAppointments, adminNow]);

    function getNotificationKey(appointmentId: string, type: WhatsAppNotificationType) {
        return `${appointmentId}:${type}`;
    }

    function markWhatsAppNotificationOpened(
        appointment: AdminAppointment,
        type: WhatsAppNotificationType,
    ) {
        const key = getNotificationKey(appointment.id, type);
        setOpenedWhatsAppNotifications((current) => ({...current, [key]: true}));
    }

    function getWhatsAppUrl(
        appointment: AdminAppointment,
        type: WhatsAppNotificationType,
    ) {
        const phone = normalizePhoneForWhatsApp(appointment.client_phone);
        const message = buildWhatsAppMessage(appointment, type);
        return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    }

    function getDueNotificationTypes(appointment: AdminAppointment) {
        if (appointment.status === "cancelled") return [] as WhatsAppNotificationType[];

        const appointmentTime = getAppointmentDateTime(appointment).getTime();
        const difference = appointmentTime - notificationClock;
        const hour = 60 * 60 * 1000;
        const types: WhatsAppNotificationType[] = [];

        if (difference > 2 * hour && difference <= 24 * hour) {
            types.push("attendance-confirmation");
        }

        if (difference > 0 && difference <= 2 * hour) {
            types.push("two-hour-reminder");
        }

        return types;
    }

    const pendingWhatsAppNotifications = useMemo(() => {
        return appointments
            .flatMap((appointment) =>
                getDueNotificationTypes(appointment).map((type) => ({
                    appointment,
                    type,
                    key: getNotificationKey(appointment.id, type),
                })),
            )
            .filter((notification) => !openedWhatsAppNotifications[notification.key])
            .sort(
                (first, second) =>
                    getAppointmentDateTime(first.appointment).getTime() -
                    getAppointmentDateTime(second.appointment).getTime(),
            );
    }, [appointments, notificationClock, openedWhatsAppNotifications]);


    const scheduleConfigVisibleWeekDates = useMemo(
        () => getManualWeekDates(scheduleConfigWeekReferenceDate),
        [scheduleConfigWeekReferenceDate],
    );

    const scheduleConfigTimes = useMemo(
        () =>
            getConfiguredClientStartMinutes(
                scheduleConfigDate,
                adminTimeOverrides,
            ).map(minutesToTime),
        [scheduleConfigDate, adminTimeOverrides],
    );

    function selectScheduleConfigDate(date: string) {
        const today = formatDateForInput(new Date());
        if (date < today) return;

        setScheduleConfigDate(date);
        setScheduleConfigWeekReferenceDate(date);
        setScheduleConfigEditingTime(null);
        setScheduleConfigEditedTime("");
        setScheduleConfigNewTime("");
        setScheduleConfigError("");
        setScheduleConfigSuccess("");
    }

    function moveScheduleConfigWeek(amount: number) {
        const currentWeek = getManualWeekDates(scheduleConfigWeekReferenceDate);
        const nextReference = addDaysToInputDate(currentWeek[0], amount * 7);
        const nextWeek = getManualWeekDates(nextReference);
        const today = formatDateForInput(new Date());
        const firstSelectable = nextWeek.find((date) => date >= today);

        setScheduleConfigWeekReferenceDate(nextReference);
        setScheduleConfigEditingTime(null);
        setScheduleConfigEditedTime("");
        setScheduleConfigError("");
        setScheduleConfigSuccess("");

        if (firstSelectable) {
            setScheduleConfigDate(firstSelectable);
        }
    }

    function normalizeScheduleConfigTime(value: string) {
        const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return null;

        const hours = Number(match[1]);
        const minutes = Number(match[2]);

        if (
            !Number.isInteger(hours) ||
            !Number.isInteger(minutes) ||
            hours < 0 ||
            hours > 23 ||
            minutes < 0 ||
            minutes > 59
        ) {
            return null;
        }

        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }

    function mergeSavedTimeOverrides(rows: ScheduleTimeOverride[]) {
        setAdminTimeOverrides((current) => {
            const savedKeys = new Set(
                rows.map(
                    (item) =>
                        `${item.override_date}|${String(item.start_time).slice(0, 5)}`,
                ),
            );

            return [
                ...current.filter(
                    (item) =>
                        !savedKeys.has(
                            `${item.override_date}|${String(item.start_time).slice(0, 5)}`,
                        ),
                ),
                ...rows.map((item) => ({
                    ...item,
                    start_time: String(item.start_time).slice(0, 5),
                })),
            ];
        });
    }

    async function saveScheduleTimeOverride(
        time: string,
        isAvailable: boolean,
    ) {
        const normalizedTime = normalizeScheduleConfigTime(time);

        if (!normalizedTime) {
            throw new Error("Informe um horário válido.");
        }

        const {data, error} = await supabase
            .from("schedule_time_overrides")
            .upsert(
                {
                    override_date: scheduleConfigDate,
                    start_time: normalizedTime,
                    is_available: isAvailable,
                    updated_at: new Date().toISOString(),
                },
                {onConflict: "override_date,start_time"},
            )
            .select("id, override_date, start_time, is_available, created_at, updated_at");

        if (error) throw error;

        mergeSavedTimeOverrides((data ?? []) as ScheduleTimeOverride[]);
    }

    async function addScheduleConfigTime() {
        setScheduleConfigError("");
        setScheduleConfigSuccess("");

        const normalizedTime = normalizeScheduleConfigTime(scheduleConfigNewTime);

        if (!normalizedTime) {
            setScheduleConfigError("Informe um horário válido.");
            return;
        }

        if (scheduleConfigTimes.includes(normalizedTime)) {
            setScheduleConfigError("Esse horário já está disponível nessa data.");
            return;
        }

        setIsSavingScheduleConfig(true);

        try {
            await saveScheduleTimeOverride(normalizedTime, true);
            setScheduleConfigNewTime("");
            setScheduleConfigSuccess(
                `Horário ${normalizedTime} adicionado somente em ${new Date(`${scheduleConfigDate}T12:00:00`).toLocaleDateString("pt-BR")}.`,
            );
        } catch (error) {
            console.error("Erro ao adicionar exceção de horário:", error);
            setScheduleConfigError("Não foi possível adicionar esse horário.");
        } finally {
            setIsSavingScheduleConfig(false);
        }
    }

    async function removeScheduleConfigTime(time: string) {
        const confirmed = window.confirm(
            `Remover ${time} somente de ${new Date(`${scheduleConfigDate}T12:00:00`).toLocaleDateString("pt-BR")}?`,
        );

        if (!confirmed) return;

        setScheduleConfigError("");
        setScheduleConfigSuccess("");
        setIsSavingScheduleConfig(true);

        try {
            await saveScheduleTimeOverride(time, false);
            setScheduleConfigEditingTime(null);
            setScheduleConfigEditedTime("");
            setScheduleConfigSuccess(
                `Horário ${time} removido somente dessa data.`,
            );
        } catch (error) {
            console.error("Erro ao remover exceção de horário:", error);
            setScheduleConfigError("Não foi possível remover esse horário.");
        } finally {
            setIsSavingScheduleConfig(false);
        }
    }

    function beginEditScheduleConfigTime(time: string) {
        setScheduleConfigEditingTime(time);
        setScheduleConfigEditedTime(time);
        setScheduleConfigError("");
        setScheduleConfigSuccess("");
    }

    async function saveEditedScheduleConfigTime() {
        if (!scheduleConfigEditingTime) return;

        const normalizedNewTime = normalizeScheduleConfigTime(
            scheduleConfigEditedTime,
        );

        if (!normalizedNewTime) {
            setScheduleConfigError("Informe um novo horário válido.");
            return;
        }

        if (normalizedNewTime === scheduleConfigEditingTime) {
            setScheduleConfigEditingTime(null);
            setScheduleConfigEditedTime("");
            return;
        }

        if (scheduleConfigTimes.includes(normalizedNewTime)) {
            setScheduleConfigError("O novo horário já existe nessa data.");
            return;
        }

        setScheduleConfigError("");
        setScheduleConfigSuccess("");
        setIsSavingScheduleConfig(true);

        try {
            const {data, error} = await supabase
                .from("schedule_time_overrides")
                .upsert(
                    [
                        {
                            override_date: scheduleConfigDate,
                            start_time: scheduleConfigEditingTime,
                            is_available: false,
                            updated_at: new Date().toISOString(),
                        },
                        {
                            override_date: scheduleConfigDate,
                            start_time: normalizedNewTime,
                            is_available: true,
                            updated_at: new Date().toISOString(),
                        },
                    ],
                    {onConflict: "override_date,start_time"},
                )
                .select("id, override_date, start_time, is_available, created_at, updated_at");

            if (error) throw error;

            mergeSavedTimeOverrides((data ?? []) as ScheduleTimeOverride[]);
            setScheduleConfigEditingTime(null);
            setScheduleConfigEditedTime("");
            setScheduleConfigSuccess(
                `Horário alterado de ${scheduleConfigEditingTime} para ${normalizedNewTime} somente nessa data.`,
            );
        } catch (error) {
            console.error("Erro ao alterar exceção de horário:", error);
            setScheduleConfigError("Não foi possível alterar esse horário.");
        } finally {
            setIsSavingScheduleConfig(false);
        }
    }

    const blockVisibleWeekDates = useMemo(
        () => getManualWeekDates(blockWeekReferenceDate),
        [blockWeekReferenceDate],
    );

    function selectBlockDate(date: string) {
        const today = formatDateForInput(new Date());
        if (date < today) return;

        setBlockDate(date);
        setBlockWeekReferenceDate(date);
        setSelectedBlockTimes([]);
        setBlockError("");
    }

    function moveBlockWeek(amount: number) {
        const currentWeek = getManualWeekDates(blockWeekReferenceDate);
        const nextReference = addDaysToInputDate(currentWeek[0], amount * 7);
        const nextWeek = getManualWeekDates(nextReference);
        const today = formatDateForInput(new Date());
        const firstSelectable = nextWeek.find((date) => date >= today);

        setBlockWeekReferenceDate(nextReference);
        setSelectedBlockTimes([]);
        setBlockError("");

        if (firstSelectable) {
            setBlockDate(firstSelectable);
        }
    }

    const blockWeekMonthLabel = useMemo(() => {
        const reference = new Date(`${blockDate}T12:00:00`);
        return reference.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
        });
    }, [blockDate]);

    const blockAvailableTimes = useMemo(() => {
        const candidateStarts = getFixedClientStartMinutes(blockDate);

        const occupied = appointments
            .filter(
                (item) =>
                    item.appointment_date === blockDate &&
                    item.status !== "cancelled",
            )
            .map((item) => {
                const start = getMinutesFromTime(item.start_time);
                return {start, end: start + item.duration_minutes};
            });

        const blocked = adminBlocks
            .filter((item) => item.block_date === blockDate)
            .map((item) => ({
                start: getMinutesFromTime(item.start_time),
                end: getMinutesFromTime(item.end_time),
            }));

        return candidateStarts
            .filter((start) => {
                const isOccupied = [...occupied, ...blocked].some((item) =>
                    intervalsOverlap(start, start + 30, item.start, item.end),
                );

                return !isOccupied;
            })
            .map(minutesToTime);
    }, [appointments, adminBlocks, blockDate]);

    useEffect(() => {
        setSelectedBlockTimes((current) => current.filter((time) => blockAvailableTimes.includes(time)));
    }, [blockAvailableTimes]);

    async function saveSelectedBlocks() {
        if (!selectedBlockTimes.length) {
            setBlockError("Selecione pelo menos um horário.");
            return;
        }
        setIsSavingBlock(true);
        setBlockError("");
        const rows = selectedBlockTimes.map((time) => ({
            block_date: blockDate,
            start_time: time,
            end_time: minutesToTime(getMinutesFromTime(time) + 30),
            reason: blockReason.trim() || null,
        }));
        const {data, error} = await supabase.from("schedule_blocks").insert(rows)
            .select("id, block_date, start_time, end_time, reason, created_at");
        if (error) {
            console.error("Erro ao bloquear horários:", error);
            setBlockError("Não foi possível bloquear os horários selecionados.");
            setIsSavingBlock(false);
            return;
        }
        setAdminBlocks((current) => [...current, ...((data ?? []) as AdminScheduleBlock[])]);
        setSelectedBlockTimes([]);
        setBlockReason("");
        setIsSavingBlock(false);
    }

    async function deleteScheduleBlock(blockId: string) {
        const {error} = await supabase.from("schedule_blocks").delete().eq("id", blockId);
        if (error) {
            setBlockError("Não foi possível remover o bloqueio.");
            return;
        }
        setAdminBlocks((current) => current.filter((item) => item.id !== blockId));
    }

    function resetServiceForm() {
        setServiceFormName("");
        setServiceFormPrice("");
        setServiceFormDuration("");
        setEditingServiceId(null);
    }

    function openServiceEditor(service: AdminServiceSetting) {
        setServiceFormName(service.name);
        setServiceFormPrice((service.price_cents / 100).toFixed(2).replace(".", ","));
        setServiceFormDuration(String(service.duration_minutes));
        setEditingServiceId(service.id);
        setExpandedServiceId(service.id);
        setSettingsError("");
        setSettingsSuccess("");

        window.setTimeout(() => {
            document.getElementById("admin-service-form")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }, 50);
    }

    async function saveServiceFromForm() {
        setSettingsError("");
        setSettingsSuccess("");

        const name = serviceFormName.trim();
        const normalizedPrice = serviceFormPrice.replace(",", ".").trim();
        const priceValue = Number(normalizedPrice);
        const durationValue = Number(serviceFormDuration);

        if (
            name.length < 2 ||
            !Number.isFinite(priceValue) ||
            priceValue < 0 ||
            !Number.isFinite(durationValue) ||
            durationValue <= 0
        ) {
            setSettingsError("Confira o nome, o valor e a duração do serviço.");
            return;
        }

        const priceCents = Math.round(priceValue * 100);
        const durationMinutes = Math.round(durationValue);

        if (editingServiceId !== null) {
            setSavingServiceId(editingServiceId);

            const {data, error} = await supabase
                .from("services")
                .update({
                    name,
                    price_cents: priceCents,
                    duration_minutes: durationMinutes,
                })
                .eq("id", editingServiceId)
                .select("id, name, description, duration_minutes, price_cents, display_order")
                .single();

            if (error || !data) {
                console.error("Erro ao editar serviço:", error);
                setSettingsError(
                    error?.message?.includes("services_name_unique")
                        ? "Já existe um serviço com esse nome."
                        : "Não foi possível atualizar o serviço.",
                );
                setSavingServiceId(null);
                return;
            }

            setAdminServices((current) =>
                current
                    .map((service) =>
                        service.id === editingServiceId
                            ? data as AdminServiceSetting
                            : service,
                    )
                    .sort(
                        (first, second) =>
                            second.price_cents - first.price_cents ||
                            first.name.localeCompare(second.name, "pt-BR"),
                    ),
            );

            setSettingsSuccess(`Serviço “${name}” atualizado com sucesso.`);
            setSavingServiceId(null);
            resetServiceForm();
            return;
        }

        setSavingServiceId(-1);

        const {data, error} = await supabase
            .from("services")
            .insert({
                name,
                description: "",
                price_cents: priceCents,
                duration_minutes: durationMinutes,
                is_active: true,
                display_order: 0,
            })
            .select("id, name, description, duration_minutes, price_cents, display_order")
            .single();

        if (error || !data) {
            console.error("Erro ao adicionar serviço:", error);
            setSettingsError(
                error?.message?.includes("services_name_unique")
                    ? "Já existe um serviço com esse nome."
                    : "Não foi possível adicionar o serviço.",
            );
            setSavingServiceId(null);
            return;
        }

        setAdminServices((current) =>
            [
                data as AdminServiceSetting,
                ...current,
            ].sort(
                (first, second) =>
                    second.price_cents - first.price_cents ||
                    first.name.localeCompare(second.name, "pt-BR"),
            ),
        );

        setSettingsSuccess(`Serviço “${name}” adicionado com sucesso.`);
        setSavingServiceId(null);
        resetServiceForm();
    }

    async function deleteAdminService(service: AdminServiceSetting) {
        const confirmed = window.confirm(
            `Excluir o serviço “${service.name}”? Ele deixará de aparecer para as clientes.`,
        );

        if (!confirmed) return;

        setSettingsError("");
        setSettingsSuccess("");
        setDeletingServiceId(service.id);

        const {error} = await supabase
            .from("services")
            .delete()
            .eq("id", service.id);

        if (error) {
            console.error("Erro ao excluir serviço:", error);
            setSettingsError("Não foi possível excluir o serviço.");
            setDeletingServiceId(null);
            return;
        }

        setAdminServices((current) =>
            current.filter((item) => item.id !== service.id),
        );

        if (editingServiceId === service.id) {
            resetServiceForm();
        }

        if (expandedServiceId === service.id) {
            setExpandedServiceId(null);
        }

        setSettingsSuccess(`Serviço “${service.name}” excluído.`);
        setDeletingServiceId(null);
    }

    function getAppointmentStatusLabel(status: AdminAppointment["status"]) {
        if (status === "completed") return "Concluído";
        if (status === "cancelled") return "Cancelado";
        if (status === "no-show") return "Não compareceu";
        if (status === "pending") return "Pendente";
        return "Confirmado";
    }

    const renderAppointmentCard = (appointment: AdminAppointment) => {
        const dueTypes = getDueNotificationTypes(appointment);

        return (
            <article
                key={appointment.id}
                className={`admin-booking-card${appointment.status === "cancelled" ? " is-cancelled" : ""}`}
                onClick={() => openAppointmentDetails(appointment)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") openAppointmentDetails(appointment);
                }}
            >
                <div className="admin-booking-card__top">
                    <div>
                        <span className="admin-booking-card__time">{String(appointment.start_time).slice(0, 5)}</span>
                        <h3>{appointment.client_name}</h3>
                    </div>
                    <span className={`admin-status admin-status--${appointment.status}`}>{getAppointmentStatusLabel(appointment.status)}</span>
                </div>
                <div className="admin-booking-card__details">
                    <div><span>Data</span><strong>{formatAdminDate(appointment.appointment_date)}</strong></div>
                    <div><span>Serviço</span><strong>{appointment.service_name}</strong></div>
                    <div><span>Duração</span><strong>{appointment.duration_minutes} min</strong></div>
                    <div><span>Telefone</span><strong>{appointment.client_phone}</strong></div>
                    <div className="admin-booking-card__music">
                        <span>Gosto musical</span>
                        <strong>{appointment.musical_taste?.trim() || "Não informado"}</strong>
                    </div>
                </div>
                <div className="admin-booking-card__footer" onClick={(event) => event.stopPropagation()}>
                    <button type="button" onClick={() => openAppointmentDetails(appointment)}>Editar detalhes</button>
                    <button type="button" onClick={() => void cancelAppointment(appointment)}>Cancelar</button>
                    {dueTypes.map((type) => {
                        const key = getNotificationKey(appointment.id, type);
                        const wasOpened = Boolean(openedWhatsAppNotifications[key]);

                        return (
                            <a
                                key={type}
                                className={`is-due${wasOpened ? " is-opened" : ""}`.trim()}
                                href={getWhatsAppUrl(appointment, type)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => markWhatsAppNotificationOpened(appointment, type)}
                            >
                                {wasOpened ? "Abrir novamente" : getWhatsAppNotificationLabel(type)}
                            </a>
                        );
                    })}
                </div>
            </article>
        );
    };

    if (isCheckingSession) {
        return <main className="admin-page"><style>{adminStyles + adminEnhancementStyles + adminServiceManagerStyles + adminEditDateTimeStyles + adminClientScheduledMetricStyles}</style><div className="admin-login"><div className="admin-loading">Verificando acesso...</div></div></main>;
    }

    if (!isAuthenticated) {
        return (
            <main className="admin-page">
                <style>{adminStyles + adminEnhancementStyles + adminServiceManagerStyles + adminEditDateTimeStyles + adminClientScheduledMetricStyles}</style>
                <div className="admin-login">
                    <form className="admin-login__card" onSubmit={handleLogin}>
                        <div className="admin-login__brand"><img className="admin-login__logo" src="/logo-mirian.png" alt="Logo Mirian Silva Nail Design"/><div><strong>Mirian Silva</strong><span>Painel administrativo</span></div></div>
                        <h1>Acesso da Mirian</h1>
                        <p>Entre com o e-mail e a senha cadastrados no Supabase.</p>
                        {loginError && <p className="admin-login__error">{loginError}</p>}
                        <div className="admin-field"><label htmlFor="admin-email">E-mail</label><input id="admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required/></div>
                        <div className="admin-field"><label htmlFor="admin-password">Senha</label><input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required/></div>
                        <button className="admin-primary-button" type="submit" disabled={isLoggingIn}>{isLoggingIn ? "Entrando..." : "Entrar no painel"}</button>
                    </form>
                </div>
            </main>
        );
    }

    return (
        <main className="admin-page">
            <style>{adminStyles + adminEnhancementStyles + adminServiceManagerStyles + adminEditDateTimeStyles + adminClientScheduledMetricStyles}</style>
            <section className="admin-panel">
                <header className="admin-header">
                    <div><h1>Painel da Mirian</h1><p>Gerencie os agendamentos recebidos pelo site.</p></div>
                    <button className="admin-secondary-button" type="button" onClick={handleLogout}>Sair</button>
                </header>

                <div className="admin-dashboard-cards">
                    <button className={`admin-dashboard-card${adminView === "agenda" ? " is-active" : ""}`} type="button" onClick={() => setAdminView("agenda")}><strong>Agenda do dia</strong><span>Veja todos os atendimentos do dia.</span></button>
                    <button className={`admin-dashboard-card${adminView === "week" ? " is-active" : ""}`} type="button" onClick={() => setAdminView("week")}><strong>Agenda semanal</strong><span>Atendimentos em ordem de dia e horário.</span></button>
                    <button className={`admin-dashboard-card${adminView === "clients" ? " is-active" : ""}`} type="button" onClick={() => setAdminView("clients")}><strong>Clientes</strong><span>Cadastros, histórico e indicadores.</span></button>
                    <button className={`admin-dashboard-card${adminView === "finance" ? " is-active" : ""}`} type="button" onClick={() => setAdminView("finance")}><strong>Financeiro</strong><span>Faturamento e previsão mensal.</span></button>
                    <button className={`admin-dashboard-card${adminView === "schedule" ? " is-active" : ""}`} type="button" onClick={() => setAdminView("schedule")}><strong>Configuração de horários</strong><span>Adicione, altere ou remova horários de uma data específica.</span></button>
                    <button className={`admin-dashboard-card${adminView === "settings" ? " is-active" : ""}`} type="button" onClick={() => setAdminView("settings")}><strong>Configuração de serviços</strong><span>Cadastre, edite e exclua serviços.</span></button>
                </div>

                <section className="admin-message-center">
                    <div className="admin-message-center__header">
                        <div>
                            <h2>Mensagens pendentes</h2>
                            <p>Abra o WhatsApp com a mensagem pronta e toque em enviar.</p>
                        </div>
                        <span className="admin-message-center__count">{pendingWhatsAppNotifications.length}</span>
                    </div>

                    {pendingWhatsAppNotifications.length ? (
                        <div className="admin-message-center__list">
                            {pendingWhatsAppNotifications.slice(0, 10).map(({appointment, type, key}) => (
                                <article className="admin-message-item" key={key}>
                                    <div>
                                        <strong>{getWhatsAppNotificationLabel(type)} — {appointment.client_name}</strong>
                                        <span>{formatAdminDate(appointment.appointment_date)} às {String(appointment.start_time).slice(0, 5)} · {appointment.service_name}</span>
                                    </div>
                                    <a
                                        href={getWhatsAppUrl(appointment, type)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => markWhatsAppNotificationOpened(appointment, type)}
                                    >
                                        Abrir WhatsApp
                                    </a>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <p className="admin-message-center__empty">Nenhuma mensagem pendente neste momento.</p>
                    )}
                </section>

                {(adminView === "agenda" || adminView === "week") && (
                    <section className="admin-top-agenda">
                        <div className="admin-top-agenda__header">
                            <div>
                                <span>{adminView === "agenda" ? "Atendimentos do dia" : "Atendimentos da semana"}</span>
                                <strong>
                                    {adminView === "agenda"
                                        ? formatAdminDate(agendaDate)
                                        : `${formatAdminDate(weekDates[0])} até ${formatAdminDate(weekDates[6])}`}
                                </strong>
                            </div>
                            <div className="admin-section-date-controls admin-section-date-controls--agenda">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextDate = addDaysToInputDate(
                                            agendaDate,
                                            adminView === "week" ? -7 : -1,
                                        );
                                        setAgendaDate(nextDate);
                                        setAgendaWeekReferenceDate(nextDate);
                                        setShowAgendaDatePicker(false);
                                        setShowAgendaMonthCalendar(false);
                                    }}
                                >
                                    ←
                                </button>

                                <div className="admin-agenda-date-picker">
                                    <button
                                        type="button"
                                        className={`admin-agenda-date-picker__trigger${
                                            showAgendaDatePicker ? " is-open" : ""
                                        }`}
                                        onClick={() =>
                                            setShowAgendaDatePicker((current) => {
                                                const nextValue = !current;

                                                if (nextValue) {
                                                    setAgendaWeekReferenceDate(agendaDate);
                                                    setShowAgendaMonthCalendar(false);
                                                }

                                                return nextValue;
                                            })
                                        }
                                    >
                                        <span className="admin-agenda-date-picker__trigger-text">
                                            <small>
                                                {adminView === "agenda"
                                                    ? "Data selecionada"
                                                    : "Semana selecionada"}
                                            </small>
                                            <strong>
                                                {adminView === "agenda"
                                                    ? formatAdminDate(agendaDate)
                                                    : `${formatAdminDate(
                                                        weekDates[0],
                                                    )} até ${formatAdminDate(
                                                        weekDates[6],
                                                    )}`}
                                            </strong>
                                        </span>

                                        <span className="admin-agenda-date-picker__chevron">
                                            {showAgendaDatePicker ? "⌃" : "⌄"}
                                        </span>
                                    </button>

                                    {showAgendaDatePicker && (
                                        <div className="admin-agenda-date-picker__panel">
                                            <div className="admin-agenda-date-picker__panel-header">
                                                <div className="admin-agenda-date-picker__month">
                                                    <strong>{agendaPickerMonthLabel}</strong>

                                                    <button
                                                        type="button"
                                                        onClick={openAgendaMonthCalendar}
                                                        aria-label="Abrir calendário do mês"
                                                    >
                                                        📅
                                                    </button>
                                                </div>

                                                <div className="admin-agenda-date-picker__panel-navs">
                                                    <button
                                                        type="button"
                                                        onClick={() => moveAgendaPickerWeek(-1)}
                                                        aria-label="Semana anterior"
                                                    >
                                                        ‹
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => moveAgendaPickerWeek(1)}
                                                        aria-label="Próxima semana"
                                                    >
                                                        ›
                                                    </button>
                                                </div>
                                            </div>

                                            {showAgendaMonthCalendar && (
                                                <div className="client-month-calendar">
                                                    <div className="client-month-calendar__header">
                                                        <button
                                                            className="client-week-picker__nav"
                                                            type="button"
                                                            onClick={() =>
                                                                setAgendaCalendarMonth(
                                                                    (current) =>
                                                                        new Date(
                                                                            current.getFullYear(),
                                                                            current.getMonth() - 1,
                                                                            1,
                                                                        ),
                                                                )
                                                            }
                                                            aria-label="Mês anterior"
                                                        >
                                                            ‹
                                                        </button>
                                                        <strong>
                                                            {agendaCalendarMonth.toLocaleDateString(
                                                                "pt-BR",
                                                                {
                                                                    month: "long",
                                                                    year: "numeric",
                                                                },
                                                            )}
                                                        </strong>
                                                        <button
                                                            className="client-week-picker__nav"
                                                            type="button"
                                                            onClick={() =>
                                                                setAgendaCalendarMonth(
                                                                    (current) =>
                                                                        new Date(
                                                                            current.getFullYear(),
                                                                            current.getMonth() + 1,
                                                                            1,
                                                                        ),
                                                                )
                                                            }
                                                            aria-label="Próximo mês"
                                                        >
                                                            ›
                                                        </button>
                                                    </div>

                                                    <div className="client-month-calendar__weekdays">
                                                        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
                                                            <span key={day}>{day}</span>
                                                        ))}
                                                    </div>

                                                    <div className="client-month-calendar__grid">
                                                        {getAgendaMonthCalendarCells().map(
                                                            (date, index) => {
                                                                if (!date) {
                                                                    return (
                                                                        <span
                                                                            className="client-month-calendar__day is-empty"
                                                                            key={`agenda-empty-${index}`}
                                                                        />
                                                                    );
                                                                }

                                                                return (
                                                                    <button
                                                                        key={date}
                                                                        type="button"
                                                                        className={[
                                                                            "client-month-calendar__day",
                                                                            date === agendaDate
                                                                                ? "is-selected"
                                                                                : "",
                                                                        ]
                                                                            .filter(Boolean)
                                                                            .join(" ")}
                                                                        onClick={() =>
                                                                            selectAgendaPickerDate(
                                                                                date,
                                                                            )
                                                                        }
                                                                    >
                                                                        {new Date(
                                                                            `${date}T12:00:00`,
                                                                        ).getDate()}
                                                                    </button>
                                                                );
                                                            },
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="client-week-days admin-agenda-date-picker__week-days">
                                                {[
                                                    {
                                                        dates: agendaVisibleWeekDates.slice(
                                                            0,
                                                            4,
                                                        ),
                                                        rowClass:
                                                            "client-week-days__row--four",
                                                    },
                                                    {
                                                        dates: agendaVisibleWeekDates.slice(
                                                            4,
                                                            7,
                                                        ),
                                                        rowClass:
                                                            "client-week-days__row--three",
                                                    },
                                                ].map((row, rowIndex) => (
                                                    <div
                                                        className={`client-week-days__row ${row.rowClass}`}
                                                        key={`agenda-week-row-${rowIndex}`}
                                                    >
                                                        {row.dates.map((date) => {
                                                            const parsed = new Date(
                                                                `${date}T12:00:00`,
                                                            );

                                                            return (
                                                                <button
                                                                    key={date}
                                                                    type="button"
                                                                    className={[
                                                                        "client-week-day",
                                                                        date === agendaDate
                                                                            ? "is-selected"
                                                                            : "",
                                                                    ]
                                                                        .filter(Boolean)
                                                                        .join(" ")}
                                                                    onClick={() =>
                                                                        selectAgendaPickerDate(
                                                                            date,
                                                                        )
                                                                    }
                                                                >
                                                                    <span>
                                                                        {parsed
                                                                            .toLocaleDateString(
                                                                                "pt-BR",
                                                                                {
                                                                                    weekday:
                                                                                        "short",
                                                                                },
                                                                            )
                                                                            .replace(
                                                                                ".",
                                                                                "",
                                                                            )}
                                                                    </span>
                                                                    <strong>
                                                                        {parsed.toLocaleDateString(
                                                                            "pt-BR",
                                                                            {
                                                                                day: "2-digit",
                                                                                month: "2-digit",
                                                                            },
                                                                        )}
                                                                    </strong>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextDate = addDaysToInputDate(
                                            agendaDate,
                                            adminView === "week" ? 7 : 1,
                                        );
                                        setAgendaDate(nextDate);
                                        setAgendaWeekReferenceDate(nextDate);
                                        setShowAgendaDatePicker(false);
                                        setShowAgendaMonthCalendar(false);
                                    }}
                                >
                                    →
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const today = formatDateForInput(new Date());
                                        setAgendaDate(today);
                                        setAgendaWeekReferenceDate(today);
                                        setShowAgendaDatePicker(false);
                                        setShowAgendaMonthCalendar(false);
                                    }}
                                >
                                    Hoje
                                </button>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="admin-loading">Carregando...</div>
                        ) : adminView === "agenda" ? (
                            <div className="admin-card-list">
                                {agendaAppointments.length
                                    ? agendaAppointments.map(renderAppointmentCard)
                                    : <div className="admin-empty admin-empty--top">Nenhum agendamento nesta data.</div>}
                            </div>
                        ) : (
                            <div className="admin-card-list">
                                {weeklyAppointments.length
                                    ? weeklyAppointments.map(renderAppointmentCard)
                                    : <div className="admin-empty admin-empty--top">Nenhum agendamento nesta semana.</div>}
                            </div>
                        )}
                    </section>
                )}

                {panelError && <p className="admin-panel__error">{panelError}</p>}

                {adminView === "finance" ? (
                    <section className="admin-finance">
                        <div className="admin-finance__header">
                            <div>
                                <span className="admin-finance__eyebrow">Controle financeiro</span>
                                <h2>Financeiro mensal</h2>
                                <p>Valores calculados automaticamente a partir dos agendamentos do mês.</p>
                            </div>

                            <div className="admin-finance-month-picker">
                                <div className="admin-finance-month-picker__quick">
                                    <button
                                        type="button"
                                        aria-label="Mês anterior"
                                        onClick={() =>
                                            setFinanceMonth((current) =>
                                                addMonthsToFinanceMonth(current, -1)
                                            )
                                        }
                                    >
                                        ←
                                    </button>

                                    <button
                                        type="button"
                                        className={`admin-finance-month-picker__selected${
                                            showFinanceMonthPicker ? " is-open" : ""
                                        }`}
                                        onClick={openFinanceMonthPicker}
                                    >
                                        <span className="admin-finance-month-picker__icon">📅</span>

                                        <span className="admin-finance-month-picker__selected-text">
                                            <small>Mês selecionado</small>
                                            <strong>{financeMonthLabel}</strong>
                                        </span>

                                        <span className="admin-finance-month-picker__chevron">
                                            {showFinanceMonthPicker ? "⌃" : "⌄"}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        aria-label="Próximo mês"
                                        onClick={() =>
                                            setFinanceMonth((current) =>
                                                addMonthsToFinanceMonth(current, 1)
                                            )
                                        }
                                    >
                                        →
                                    </button>
                                </div>

                                {showFinanceMonthPicker && (
                                    <div className="admin-finance-month-panel">
                                        <div className="admin-finance-month-panel__header">
                                            <button
                                                type="button"
                                                aria-label="Ano anterior"
                                                onClick={() =>
                                                    setFinancePickerYear((current) => current - 1)
                                                }
                                            >
                                                ‹
                                            </button>

                                            <strong>{financePickerYear}</strong>

                                            <button
                                                type="button"
                                                aria-label="Próximo ano"
                                                onClick={() =>
                                                    setFinancePickerYear((current) => current + 1)
                                                }
                                            >
                                                ›
                                            </button>
                                        </div>

                                        <div className="admin-finance-month-panel__grid">
                                            {financeMonthOptions.map((monthName, index) => {
                                                const monthValue =
                                                    `${financePickerYear}-${String(index + 1).padStart(2, "0")}`;

                                                const selected =
                                                    financeMonth === monthValue;

                                                return (
                                                    <button
                                                        key={monthName}
                                                        type="button"
                                                        className={selected ? "is-selected" : ""}
                                                        onClick={() => selectFinanceMonth(index)}
                                                    >
                                                        <span>{monthName.slice(0, 3)}</span>
                                                        <strong>{monthName}</strong>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <button
                                            type="button"
                                            className="admin-finance-month-panel__current"
                                            onClick={selectCurrentFinanceMonth}
                                        >
                                            Ir para o mês atual
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="admin-finance__period">
                            <span>Resumo de</span>
                            <strong>{financeMonthLabel}</strong>
                        </div>

                        <div className="admin-finance__cards">
                            <article className="admin-finance-card admin-finance-card--completed">
                                <span>Faturamento realizado</span>
                                <strong>{formatCurrency(completedRevenueCents)}</strong>
                                <small>Somente atendimentos concluídos</small>
                            </article>

                            <article className="admin-finance-card">
                                <span>Valor agendado</span>
                                <strong>{formatCurrency(scheduledRevenueCents)}</strong>
                                <small>Atendimentos confirmados ou pendentes</small>
                            </article>

                            <article className="admin-finance-card admin-finance-card--forecast">
                                <span>Previsão total do mês</span>
                                <strong>{formatCurrency(forecastRevenueCents)}</strong>
                                <small>Realizado + agendado</small>
                            </article>

                            <article className="admin-finance-card">
                                <span>Atendimentos realizados</span>
                                <strong>{completedFinanceAppointments.length}</strong>
                                <small>Serviços marcados como concluídos</small>
                            </article>
                        </div>

                        <section className="admin-finance__services">
                            <div className="admin-finance__services-header">
                                <div>
                                    <h3>Resumo por serviço</h3>
                                    <p>Quantidade e valores de cada serviço no mês selecionado.</p>
                                </div>
                            </div>

                            {financeServiceSummary.length ? (
                                <div className="admin-finance-service-cards">
                                    {financeServiceSummary.map((service) => (
                                        <article
                                            className="admin-finance-service-card"
                                            key={service.serviceName}
                                        >
                                            <div className="admin-finance-service-card__row admin-finance-service-card__row--service">
                                                <span>Serviço</span>
                                                <strong>{service.serviceName}</strong>
                                            </div>

                                            <div className="admin-finance-service-card__row">
                                                <span>Atendimentos realizados</span>
                                                <strong>{service.completedCount}</strong>
                                            </div>

                                            <div className="admin-finance-service-card__row">
                                                <span>Valor realizado</span>
                                                <strong>
                                                    {formatCurrency(service.completedCents)}
                                                </strong>
                                            </div>

                                            <div className="admin-finance-service-card__row">
                                                <span>Atendimentos agendados</span>
                                                <strong>{service.scheduledCount}</strong>
                                            </div>

                                            <div className="admin-finance-service-card__row">
                                                <span>Valor agendado</span>
                                                <strong>
                                                    {formatCurrency(service.scheduledCents)}
                                                </strong>
                                            </div>

                                            <div className="admin-finance-service-card__row admin-finance-service-card__row--total">
                                                <span>Total previsto</span>
                                                <strong>
                                                    {formatCurrency(
                                                        service.completedCents +
                                                        service.scheduledCents,
                                                    )}
                                                </strong>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="admin-finance__empty">
                                    <strong>Nenhum valor para este mês.</strong>
                                    <span>Os agendamentos confirmados e concluídos aparecerão aqui automaticamente.</span>
                                </div>
                            )}
                        </section>

                        <p className="admin-finance__note">
                            Ao chegar o horário, o agendamento é considerado realizado automaticamente. Cancelados e não comparecimentos não entram nos valores financeiros.
                        </p>
                    </section>
                ) : adminView === "schedule" ? (
                    <section className="admin-settings admin-service-manager">
                        <div className="admin-settings__intro">
                            <div>
                                <span className="admin-settings__eyebrow">Configurações do site</span>
                                <h2>Configuração de horários</h2>
                                <p>Adicione, altere ou exclua horários somente na data escolhida.</p>
                            </div>
                        </div>

                        <section className="admin-service-form-card admin-schedule-config-card">
                            <div className="admin-service-form-card__heading">
                                <div>
                                    <span>CONFIGURAÇÃO DE HORÁRIOS</span>
                                    <h3>Horários de uma data específica</h3>
                                    <p>
                                        Selecione o dia abaixo. Depois adicione um novo horário ou toque em um horário disponível para alterar ou excluir somente nessa data.
                                    </p>
                                </div>
                            </div>

                            <div className="admin-manual-week-picker admin-schedule-config-panel">
                                <div className="admin-manual-week-picker__top">
                                    <div className="admin-manual-week-picker__month">
                                        <strong>
                                            {new Date(`${scheduleConfigDate}T12:00:00`).toLocaleDateString("pt-BR", {
                                                month: "long",
                                                year: "numeric",
                                            })}
                                        </strong>
                                    </div>

                                    <div className="admin-manual-week-picker__navs">
                                        <button
                                            type="button"
                                            aria-label="Semana anterior"
                                            onClick={() => moveScheduleConfigWeek(-1)}
                                        >
                                            ‹
                                        </button>
                                        <button
                                            type="button"
                                            aria-label="Próxima semana"
                                            onClick={() => moveScheduleConfigWeek(1)}
                                        >
                                            ›
                                        </button>
                                    </div>
                                </div>

                                <div className="admin-manual-week-days">
                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--four">
                                        {scheduleConfigVisibleWeekDates.slice(0, 4).map((date) => {
                                            const parsed = new Date(`${date}T12:00:00`);
                                            const isPast = date < formatDateForInput(new Date());

                                            return (
                                                <button
                                                    key={date}
                                                    type="button"
                                                    disabled={isPast}
                                                    className={`admin-manual-week-day${date === scheduleConfigDate ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                    onClick={() => selectScheduleConfigDate(date)}
                                                >
                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                    <strong>{parsed.toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit"})}</strong>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--three">
                                        {scheduleConfigVisibleWeekDates.slice(4).map((date) => {
                                            const parsed = new Date(`${date}T12:00:00`);
                                            const isPast = date < formatDateForInput(new Date());

                                            return (
                                                <button
                                                    key={date}
                                                    type="button"
                                                    disabled={isPast}
                                                    className={`admin-manual-week-day${date === scheduleConfigDate ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                    onClick={() => selectScheduleConfigDate(date)}
                                                >
                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                    <strong>{parsed.toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit"})}</strong>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <section className="admin-manual-booking__section admin-schedule-config-manual-section">
                                <span className="admin-manual-booking__step">4</span>

                                <div className="admin-manual-booking__content">
                                    <h3>Horário disponível</h3>
                                    <p>
                                        Adicione um novo horário abaixo. Depois ele entra automaticamente na lista de horários disponíveis dessa data.
                                    </p>

                                    <div className="admin-schedule-config-add-inline">
                                        <label>
                                            <span>ADD NOVO HORÁRIO</span>
                                            <input
                                                type="time"
                                                value={scheduleConfigNewTime}
                                                onChange={(event) => setScheduleConfigNewTime(event.target.value)}
                                            />
                                        </label>

                                        <button
                                            type="button"
                                            disabled={isSavingScheduleConfig || !scheduleConfigNewTime}
                                            onClick={() => void addScheduleConfigTime()}
                                        >
                                            {isSavingScheduleConfig ? "Salvando..." : "Salvar horário"}
                                        </button>
                                    </div>

                                    {scheduleConfigError && (
                                        <p className="admin-settings__message admin-settings__message--error">
                                            {scheduleConfigError}
                                        </p>
                                    )}

                                    {scheduleConfigSuccess && (
                                        <p className="admin-settings__message admin-settings__message--success">
                                            {scheduleConfigSuccess}
                                        </p>
                                    )}

                                    <div className="admin-schedule-config-current-date">
                                        <span>DATA SELECIONADA</span>
                                        <strong>
                                            {new Date(`${scheduleConfigDate}T12:00:00`).toLocaleDateString("pt-BR", {
                                                weekday: "short",
                                                day: "2-digit",
                                                month: "2-digit",
                                                year: "numeric",
                                            })}
                                        </strong>
                                    </div>

                                    {scheduleConfigTimes.length ? (
                                        <div className="admin-manual-times admin-schedule-config-times-grid">
                                            {scheduleConfigTimes.map((time) => (
                                                <button
                                                    key={time}
                                                    type="button"
                                                    className={scheduleConfigEditingTime === time ? "is-selected" : ""}
                                                    onClick={() => beginEditScheduleConfigTime(time)}
                                                >
                                                    {time}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="admin-manual-times__empty">
                                            Nenhum horário disponível nessa data.
                                        </div>
                                    )}

                                    {scheduleConfigEditingTime && (
                                        <div className="admin-schedule-config-editor">
                                            <div className="admin-schedule-config-editor__header">
                                                <span>HORÁRIO SELECIONADO</span>
                                                <strong>{scheduleConfigEditingTime}</strong>
                                            </div>

                                            <div className="admin-schedule-config-editor__actions">
                                                <label>
                                                    <span>NOVO HORÁRIO</span>
                                                    <input
                                                        type="time"
                                                        value={scheduleConfigEditedTime}
                                                        onChange={(event) => setScheduleConfigEditedTime(event.target.value)}
                                                    />
                                                </label>

                                                <button
                                                    type="button"
                                                    disabled={isSavingScheduleConfig}
                                                    onClick={() => void saveEditedScheduleConfigTime()}
                                                >
                                                    Salvar alteração
                                                </button>

                                                <button
                                                    type="button"
                                                    className="is-danger"
                                                    disabled={isSavingScheduleConfig}
                                                    onClick={() => void removeScheduleConfigTime(scheduleConfigEditingTime)}
                                                >
                                                    Excluir horário
                                                </button>

                                                <button
                                                    type="button"
                                                    className="is-secondary"
                                                    disabled={isSavingScheduleConfig}
                                                    onClick={() => {
                                                        setScheduleConfigEditingTime(null);
                                                        setScheduleConfigEditedTime("");
                                                        setScheduleConfigError("");
                                                    }}
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </section>
                    </section>
                ) : adminView === "settings" ? (
                    <section className="admin-settings admin-service-manager">
                        <div className="admin-settings__intro">
                            <div>
                                <span className="admin-settings__eyebrow">Configurações do site</span>
                                <h2>Configuração de serviços</h2>
                                <p>Cadastre, edite ou exclua os serviços. A lista é organizada do maior para o menor valor.</p>
                            </div>
                        </div>

                        {settingsError && (
                            <p className="admin-settings__message admin-settings__message--error">
                                {settingsError}
                            </p>
                        )}

                        {settingsSuccess && (
                            <p className="admin-settings__message admin-settings__message--success">
                                {settingsSuccess}
                            </p>
                        )}


                        <section
                            id="admin-service-form"
                            className="admin-service-form-card"
                        >
                            <div className="admin-service-form-card__heading">
                                <div>
                                    <span>
                                        {editingServiceId !== null
                                            ? "EDITAR SERVIÇO"
                                            : "NOVO SERVIÇO"}
                                    </span>
                                    <h3>
                                        {editingServiceId !== null
                                            ? "Atualize as informações"
                                            : "Adicionar serviço"}
                                    </h3>
                                </div>

                                {editingServiceId !== null && (
                                    <button
                                        type="button"
                                        className="admin-service-form-card__cancel"
                                        onClick={resetServiceForm}
                                    >
                                        Cancelar edição
                                    </button>
                                )}
                            </div>

                            <div className="admin-service-form-fields">
                                <label>
                                    <span>NOME DO SERVIÇO</span>
                                    <input
                                        type="text"
                                        value={serviceFormName}
                                        onChange={(event) =>
                                            setServiceFormName(event.target.value)
                                        }
                                        placeholder="Ex.: Esmaltação em Gel"
                                    />
                                </label>

                                <label>
                                    <span>VALOR DO SERVIÇO</span>
                                    <div className="admin-service-price-field">
                                        <span>R$</span>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={serviceFormPrice}
                                            onChange={(event) =>
                                                setServiceFormPrice(
                                                    event.target.value.replace(
                                                        /[^0-9,.]/g,
                                                        "",
                                                    ),
                                                )
                                            }
                                            placeholder="0,00"
                                        />
                                    </div>
                                </label>

                                <label>
                                    <span>DURAÇÃO DO SERVIÇO</span>
                                    <div className="admin-service-duration-field">
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={serviceFormDuration}
                                            onChange={(event) =>
                                                setServiceFormDuration(event.target.value)
                                            }
                                            placeholder="90"
                                        />
                                        <span>minutos</span>
                                    </div>
                                </label>
                            </div>

                            <button
                                type="button"
                                className="admin-service-form-card__save"
                                disabled={savingServiceId !== null}
                                onClick={() => void saveServiceFromForm()}
                            >
                                {savingServiceId !== null
                                    ? "Salvando..."
                                    : editingServiceId !== null
                                        ? "Salvar alterações"
                                        : "Salvar serviço"}
                            </button>
                        </section>

                        <section className="admin-service-list-section">
                            <div className="admin-service-list-section__heading">
                                <div>
                                    <span>SERVIÇOS CADASTRADOS</span>
                                    <h3>Serviços disponíveis</h3>
                                </div>
                                <strong>{adminServices.length}</strong>
                            </div>

                            <div className="admin-service-cards">
                                {adminServices.map((service) => {
                                    const isExpanded =
                                        expandedServiceId === service.id;

                                    return (
                                        <article
                                            className={`admin-service-summary-card${
                                                isExpanded ? " is-expanded" : ""
                                            }`}
                                            key={service.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() =>
                                                setExpandedServiceId((current) =>
                                                    current === service.id
                                                        ? null
                                                        : service.id,
                                                )
                                            }
                                            onKeyDown={(event) => {
                                                if (
                                                    event.key === "Enter" ||
                                                    event.key === " "
                                                ) {
                                                    event.preventDefault();
                                                    setExpandedServiceId((current) =>
                                                        current === service.id
                                                            ? null
                                                            : service.id,
                                                    );
                                                }
                                            }}
                                        >
                                            <div className="admin-service-summary-card__main">
                                                <div className="admin-service-summary-card__icon">
                                                    ✦
                                                </div>

                                                <div className="admin-service-summary-card__content">
                                                    <strong>{service.name}</strong>

                                                    <div className="admin-service-summary-card__details">
                                                        <span>
                                                            <small>Valor</small>
                                                            <b>
                                                                {formatCurrency(
                                                                    service.price_cents,
                                                                )}
                                                            </b>
                                                        </span>

                                                        <span>
                                                            <small>Duração</small>
                                                            <b>
                                                                {formatDuration(
                                                                    service.duration_minutes,
                                                                )}
                                                            </b>
                                                        </span>
                                                    </div>
                                                </div>

                                                <span className="admin-service-summary-card__chevron">
                                                    {isExpanded ? "⌃" : "⌄"}
                                                </span>
                                            </div>

                                            {isExpanded && (
                                                <div
                                                    className="admin-service-summary-card__actions"
                                                    onClick={(event) =>
                                                        event.stopPropagation()
                                                    }
                                                >
                                                    <button
                                                        type="button"
                                                        className="edit"
                                                        onClick={() =>
                                                            openServiceEditor(service)
                                                        }
                                                    >
                                                        Editar serviço
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="delete"
                                                        disabled={
                                                            deletingServiceId === service.id
                                                        }
                                                        onClick={() =>
                                                            void deleteAdminService(service)
                                                        }
                                                    >
                                                        {deletingServiceId === service.id
                                                            ? "Excluindo..."
                                                            : "Excluir serviço"}
                                                    </button>
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    </section>
                ) : adminView === "clients" ? (
                    <section className="admin-clients">
                        <div className="admin-clients__header"><div><span className="admin-clients__eyebrow">Clientes</span><h2>Cadastros das clientes</h2><p>Consulte histórico, edite ou exclua um cadastro.</p></div><div className="admin-clients__count"><strong>{clients.length}</strong><span>clientes cadastradas</span></div></div>
                        <div className="admin-clients__search"><label>Buscar cliente<input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Nome ou telefone"/></label></div>
                        <div className="admin-clients__grid">
                            {filteredClients.map((client) => {
                                const realized = client.appointments.filter(
                                    (item) =>
                                        item.status !== "cancelled" &&
                                        item.status !== "no-show" &&
                                        (
                                            item.status === "completed" ||
                                            getAppointmentEndDateTime(item).getTime() <=
                                            adminNow.getTime()
                                        ),
                                ).length;

                                const scheduled = client.appointments.filter(
                                    (item) =>
                                        item.status !== "cancelled" &&
                                        item.status !== "no-show" &&
                                        item.status !== "completed" &&
                                        getAppointmentEndDateTime(item).getTime() >
                                        adminNow.getTime(),
                                ).length;

                                const cancelled = client.appointments.filter(
                                    (item) => item.status === "cancelled",
                                ).length;

                                return (
                                    <article className="admin-client-card" key={client.key}>
                                        <div className="admin-client-card__top"><div className="admin-client-card__avatar">{client.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div><div><h3>{client.name}</h3><a href={`https://wa.me/${normalizePhoneForWhatsApp(client.phone)}`} target="_blank" rel="noopener noreferrer">{client.phone}</a><span>{client.email || "E-mail não informado"}</span></div></div>
                                        <div className="admin-client-card__metrics">
                                            <div>
                                                <span>Atendimentos realizados</span>
                                                <strong>{realized}</strong>
                                            </div>
                                            <div>
                                                <span>Atendimentos agendados</span>
                                                <strong>{scheduled}</strong>
                                            </div>
                                            <div>
                                                <span>Atendimentos cancelados</span>
                                                <strong>{cancelled}</strong>
                                            </div>
                                        </div>
                                        {client.nextAppointment && <div className="admin-client-card__next"><span>Próximo</span><strong>{formatAdminDate(client.nextAppointment.appointment_date)} às {String(client.nextAppointment.start_time).slice(0, 5)}</strong></div>}
                                        <div className="admin-client-card__actions">
                                            <button type="button" onClick={() => openClientHistory(client)}>Ver histórico</button>
                                            <button type="button" className="is-nail-record" onClick={() => openNailRecordForClient(client)}>📷 Registrar estado da unha</button>
                                            <button type="button" className="is-secondary" onClick={() => openClientEditor(client)}>Editar cadastro</button>
                                            <button type="button" className="is-danger" disabled={deletingClientKey === client.key} onClick={() => void deleteClient(client)}>{deletingClientKey === client.key ? "Excluindo..." : "Remover da lista"}</button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                ) : (
                    <section className="admin-content-section">
                        <section className="admin-new-appointment">
                            <div className="admin-new-appointment__header">
                                <div>
                                    <h2>Novo agendamento</h2>
                                    <p>Busque a cliente cadastrada e escolha serviço, dia e horário no mesmo padrão do agendamento da cliente.</p>
                                </div>
                                <button
                                    className="admin-new-appointment__toggle"
                                    type="button"
                                    onClick={() => {
                                        setShowManualForm((current) => !current);
                                        setManualError("");
                                        setManualSuccess("");
                                    }}
                                >
                                    {showManualForm ? "Fechar" : "+ Adicionar"}
                                </button>
                            </div>

                            {showManualForm && (
                                <form className="admin-manual-booking" onSubmit={createManualAppointment}>
                                    <section className="admin-manual-booking__section">
                                        <span className="admin-manual-booking__step">1</span>
                                        <div className="admin-manual-booking__content">
                                            <h3>Buscar cliente</h3>
                                            <p>Digite o nome ou telefone e selecione uma cliente cadastrada.</p>

                                            <div className="admin-client-picker">
                                                <input
                                                    value={manualClientSearch}
                                                    onChange={(event) => {
                                                        setManualClientSearch(event.target.value);
                                                        setSelectedManualClient(null);
                                                        setManualError("");
                                                    }}
                                                    placeholder="Buscar por nome ou telefone"
                                                    autoComplete="off"
                                                />

                                                {manualClientSearch.trim() && !selectedManualClient && (
                                                    <div className="admin-client-picker__results">
                                                        {filteredManualBookingClients.length ? (
                                                            filteredManualBookingClients.map((client) => (
                                                                <button
                                                                    type="button"
                                                                    key={client.key}
                                                                    onClick={() => {
                                                                        setSelectedManualClient(client);
                                                                        setManualClientSearch(client.name);
                                                                        setManualError("");
                                                                    }}
                                                                >
                                                                    <span className="admin-client-picker__avatar">
                                                                        {client.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                                                                    </span>
                                                                    <span>
                                                                        <strong>{client.name}</strong>
                                                                        <small>{client.phone}{client.email ? ` • ${client.email}` : ""}</small>
                                                                    </span>
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="admin-client-picker__empty">Nenhuma cliente encontrada.</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {selectedManualClient && (
                                                <div className="admin-selected-client">
                                                    <div>
                                                        <span>Cliente selecionada</span>
                                                        <strong>{selectedManualClient.name}</strong>
                                                        <small>{selectedManualClient.phone}{selectedManualClient.email ? ` • ${selectedManualClient.email}` : ""}</small>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedManualClient(null);
                                                            setManualClientSearch("");
                                                        }}
                                                    >
                                                        Trocar
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    <section className="admin-manual-booking__section">
                                        <span className="admin-manual-booking__step">2</span>
                                        <div className="admin-manual-booking__content">
                                            <h3>Serviço</h3>
                                            <select
                                                className="admin-manual-booking__service"
                                                value={manualServiceName}
                                                onChange={(event) => {
                                                    setManualServiceName(event.target.value);
                                                    setManualTime("");
                                                    setManualError("");
                                                }}
                                            >
                                                {adminServices.map((service) => (
                                                    <option key={service.id} value={service.name}>
                                                        {service.name} — {service.duration_minutes} min — {formatCurrency(service.price_cents)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </section>

                                    <section className="admin-manual-booking__section">
                                        <span className="admin-manual-booking__step">3</span>
                                        <div className="admin-manual-booking__content">
                                            <h3>Dia</h3>

                                            <div className="admin-manual-week-picker">
                                                <div className="admin-manual-week-picker__top">
                                                    <div className="admin-manual-week-picker__month">
                                                        <button type="button" onClick={openManualMonthCalendar}>📅</button>
                                                        <strong>
                                                            {new Date(`${manualWeekReferenceDate}T12:00:00`).toLocaleDateString("pt-BR", {month: "long", year: "numeric"})}
                                                        </strong>
                                                    </div>

                                                    <div className="admin-manual-week-picker__navs">
                                                        <button type="button" onClick={() => moveManualBookingWeek(-1)}>‹</button>
                                                        <button type="button" onClick={() => moveManualBookingWeek(1)}>›</button>
                                                    </div>
                                                </div>

                                                <div className="admin-manual-week-days">
                                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--four">
                                                        {manualVisibleWeekDates.slice(0, 4).map((date) => {
                                                            const parsed = new Date(`${date}T12:00:00`);
                                                            const isPast = date < formatDateForInput(new Date());
                                                            return (
                                                                <button
                                                                    key={date}
                                                                    type="button"
                                                                    disabled={isPast}
                                                                    className={`admin-manual-week-day${manualDate === date ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                                    onClick={() => selectManualBookingDate(date)}
                                                                >
                                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                                    <strong>{String(parsed.getDate()).padStart(2, "0")}</strong>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--three">
                                                        {manualVisibleWeekDates.slice(4).map((date) => {
                                                            const parsed = new Date(`${date}T12:00:00`);
                                                            const isPast = date < formatDateForInput(new Date());
                                                            return (
                                                                <button
                                                                    key={date}
                                                                    type="button"
                                                                    disabled={isPast}
                                                                    className={`admin-manual-week-day${manualDate === date ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                                    onClick={() => selectManualBookingDate(date)}
                                                                >
                                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                                    <strong>{String(parsed.getDate()).padStart(2, "0")}</strong>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {showManualMonthCalendar && (
                                                    <div className="admin-manual-month-calendar">
                                                        <div className="admin-manual-month-calendar__header">
                                                            <button type="button" onClick={() => setManualCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button>
                                                            <strong>{manualCalendarMonth.toLocaleDateString("pt-BR", {month: "long", year: "numeric"})}</strong>
                                                            <button type="button" onClick={() => setManualCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button>
                                                        </div>

                                                        <div className="admin-manual-month-calendar__weekdays">
                                                            {['SEG','TER','QUA','QUI','SEX','SÁB','DOM'].map((day) => <span key={day}>{day}</span>)}
                                                        </div>

                                                        <div className="admin-manual-month-calendar__grid">
                                                            {getManualMonthCalendarCells().map((date, index) => {
                                                                if (!date) return <span className="is-empty" key={`empty-${index}`}/>;
                                                                const isPast = date < formatDateForInput(new Date());
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        key={date}
                                                                        disabled={isPast}
                                                                        className={`${manualDate === date ? "is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                                        onClick={() => selectManualBookingDate(date)}
                                                                    >
                                                                        {new Date(`${date}T12:00:00`).getDate()}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </section>

                                    <section className="admin-manual-booking__section">
                                        <span className="admin-manual-booking__step">4</span>
                                        <div className="admin-manual-booking__content">
                                            <h3>Horário disponível</h3>
                                            <p>{manualSelectedService ? `Duração do serviço: ${manualSelectedService.duration_minutes} min.` : ""}</p>

                                            <div className="admin-manual-times">
                                                {manualAvailableTimes.map((time) => (
                                                    <button
                                                        key={time}
                                                        type="button"
                                                        className={manualTime === time ? "is-selected" : ""}
                                                        onClick={() => {
                                                            setManualTime(time);
                                                            setManualError("");
                                                        }}
                                                    >
                                                        {time}
                                                    </button>
                                                ))}
                                            </div>

                                            {!manualAvailableTimes.length && (
                                                <div className="admin-manual-times__empty">Nenhum horário disponível para este serviço neste dia.</div>
                                            )}
                                        </div>
                                    </section>

                                    <div className="admin-manual-booking__summary">
                                        <div><span>Cliente</span><strong>{selectedManualClient?.name || "Selecione a cliente"}</strong></div>
                                        <div><span>Serviço</span><strong>{manualServiceName || "Selecione o serviço"}</strong></div>
                                        <div><span>Data</span><strong>{manualDate ? formatAdminDate(manualDate) : "Selecione o dia"}</strong></div>
                                        <div><span>Horário</span><strong>{manualTime || "Selecione o horário"}</strong></div>
                                    </div>

                                    <div className="admin-manual-booking__actions">
                                        <button
                                            className="admin-manual-form__save"
                                            type="submit"
                                            disabled={isSavingManualAppointment || !selectedManualClient || !manualTime}
                                        >
                                            {isSavingManualAppointment ? "Criando..." : "Salvar agendamento"}
                                        </button>
                                        <button
                                            className="admin-manual-form__cancel"
                                            type="button"
                                            onClick={() => setShowManualForm(false)}
                                        >
                                            Cancelar
                                        </button>
                                    </div>

                                    {manualError && <p className="admin-manual-form__error">{manualError}</p>}
                                    {manualSuccess && <p className="admin-manual-form__success">{manualSuccess}</p>}
                                </form>
                            )}
                        </section>

                        <section className="admin-block-manager admin-block-manager--bottom">
                            <div className="admin-block-manager__header">
                                <div>
                                    <h2>Bloquear horários</h2>
                                    <p>Escolha um dia da semana e marque vários horários livres de uma só vez.</p>
                                </div>
                            </div>

                            <div className="admin-manual-week-picker">
                                <div className="admin-manual-week-picker__top">
                                    <div className="admin-manual-week-picker__month">
                                        <strong style={{textTransform: "capitalize"}}>{blockWeekMonthLabel}</strong>
                                    </div>

                                    <div className="admin-manual-week-picker__navs">
                                        <button
                                            type="button"
                                            aria-label="Semana anterior"
                                            onClick={() => moveBlockWeek(-1)}
                                        >
                                            ‹
                                        </button>
                                        <button
                                            type="button"
                                            aria-label="Próxima semana"
                                            onClick={() => moveBlockWeek(1)}
                                        >
                                            ›
                                        </button>
                                    </div>
                                </div>

                                <div className="admin-manual-week-days">
                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--four">
                                        {blockVisibleWeekDates.slice(0, 4).map((date) => {
                                            const parsed = new Date(`${date}T12:00:00`);
                                            const isPast = date < formatDateForInput(new Date());

                                            return (
                                                <button
                                                    key={date}
                                                    type="button"
                                                    disabled={isPast}
                                                    className={`admin-manual-week-day${date === blockDate ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                    onClick={() => selectBlockDate(date)}
                                                >
                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                    <strong>{parsed.toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit"})}</strong>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="admin-manual-week-days__row admin-manual-week-days__row--three">
                                        {blockVisibleWeekDates.slice(4).map((date) => {
                                            const parsed = new Date(`${date}T12:00:00`);
                                            const isPast = date < formatDateForInput(new Date());

                                            return (
                                                <button
                                                    key={date}
                                                    type="button"
                                                    disabled={isPast}
                                                    className={`admin-manual-week-day${date === blockDate ? " is-selected" : ""}${isPast ? " is-past" : ""}`}
                                                    onClick={() => selectBlockDate(date)}
                                                >
                                                    <span>{parsed.toLocaleDateString("pt-BR", {weekday: "short"}).replace(".", "")}</span>
                                                    <strong>{parsed.toLocaleDateString("pt-BR", {day: "2-digit", month: "2-digit"})}</strong>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="admin-block-date-row">
                                <div>
                                    <strong>
                                        Horários livres em {new Date(`${blockDate}T12:00:00`).toLocaleDateString("pt-BR")}
                                    </strong>
                                    <p>Toque nos horários que deseja bloquear. Cada card representa 30 minutos.</p>
                                </div>
                                <div>
                                    <strong>{selectedBlockTimes.length} horário(s) selecionado(s)</strong>
                                </div>
                            </div>

                            <div className="admin-block-times">
                                {blockAvailableTimes.map((time) => (
                                    <button
                                        key={time}
                                        className={`admin-block-time${selectedBlockTimes.includes(time) ? " is-selected" : ""}`}
                                        type="button"
                                        onClick={() =>
                                            setSelectedBlockTimes((current) =>
                                                current.includes(time)
                                                    ? current.filter((item) => item !== time)
                                                    : [...current, time],
                                            )
                                        }
                                    >
                                        {time}
                                    </button>
                                ))}
                            </div>

                            {!blockAvailableTimes.length && (
                                <div className="admin-empty">Não há horários livres nesta data.</div>
                            )}

                            <div className="admin-block-submit-row">
                                <input
                                    value={blockReason}
                                    onChange={(event) => setBlockReason(event.target.value)}
                                    placeholder="Motivo opcional"
                                />
                                <button
                                    type="button"
                                    disabled={isSavingBlock || !selectedBlockTimes.length}
                                    onClick={() => void saveSelectedBlocks()}
                                >
                                    {isSavingBlock ? "Bloqueando..." : "Bloquear selecionados"}
                                </button>
                            </div>

                            {blockError && <p className="admin-block-error">{blockError}</p>}

                            <div className="admin-block-list">
                                {adminBlocks
                                    .filter((item) => item.block_date === blockDate)
                                    .map((block) => (
                                        <div className="admin-block-item" key={block.id}>
                                            <div>
                                                <strong>
                                                    {String(block.start_time).slice(0, 5)}–{String(block.end_time).slice(0, 5)}
                                                </strong>
                                                <span>{block.reason || "Horário bloqueado"}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void deleteScheduleBlock(block.id)}
                                            >
                                                Remover
                                            </button>
                                        </div>
                                    ))}
                            </div>
                        </section>
                    </section>
                )}

                {selectedAdminAppointment && (
                    <div className="admin-modal-backdrop" onMouseDown={(event) => {if (event.target === event.currentTarget) setSelectedAdminAppointment(null);}}>
                        <section className="admin-modal">
                            <div className="admin-modal__header"><div><h2>Editar agendamento</h2><p>Altere os dados ou cancele o agendamento.</p></div><button className="admin-modal__close" type="button" onClick={() => setSelectedAdminAppointment(null)}>×</button></div>
                            <div className="admin-modal__body">
                                <div className="admin-edit-form">
                                    <label>Nome da cliente<input value={editAppointmentName} onChange={(event) => setEditAppointmentName(event.target.value)}/></label>
                                    <label>Telefone<input value={editAppointmentPhone} onChange={(event) => setEditAppointmentPhone(event.target.value)}/></label>

                                    <label className="admin-edit-form__full">
                                        Gosto musical
                                        <textarea
                                            value={editAppointmentMusicTaste}
                                            onChange={(event) => setEditAppointmentMusicTaste(event.target.value)}
                                            placeholder="Ex.: pagode, sertanejo, pop, anos 80..."
                                            rows={3}
                                            maxLength={500}
                                        />
                                    </label>

                                    <label className="admin-edit-form__full">E-mail<input type="email" value={editAppointmentEmail} onChange={(event) => setEditAppointmentEmail(event.target.value)}/></label>

                                    <label className="admin-edit-form__full">
                                        Serviço
                                        <select
                                            value={editAppointmentService}
                                            onChange={(event) => {
                                                setEditAppointmentService(event.target.value);
                                                setEditAppointmentTime("");
                                                setAppointmentEditError("");
                                            }}
                                        >
                                            {adminServices.map((service) => (
                                                <option key={service.id} value={service.name}>
                                                    {service.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <div className="admin-edit-date-time admin-edit-form__full">
                                        <span className="admin-edit-date-time__label">Data e hora</span>

                                        <button
                                            type="button"
                                            className={`admin-edit-date-time__toggle${
                                                showEditDateTimePicker ? " is-open" : ""
                                            }`}
                                            onClick={() => {
                                                setShowEditDateTimePicker((current) => !current);
                                                setAppointmentEditError("");
                                            }}
                                        >
                                            <span className="admin-edit-date-time__icon" aria-hidden="true">
                                                📅
                                            </span>

                                            <div className="admin-edit-date-time__selected">
                                                <small>Data selecionada</small>
                                                <strong>
                                                    {editAppointmentDate
                                                        ? formatAdminDate(editAppointmentDate)
                                                        : "Escolha uma data"}
                                                </strong>

                                                <span className="admin-edit-date-time__time">
                                                    {editAppointmentTime
                                                        ? editAppointmentTime
                                                        : "Escolha o horário"}
                                                </span>
                                            </div>

                                            <span
                                                className="admin-edit-date-time__chevron"
                                                aria-hidden="true"
                                            >
                                                {showEditDateTimePicker ? "⌃" : "⌄"}
                                            </span>
                                        </button>

                                        {showEditDateTimePicker && (
                                            <div className="admin-edit-date-time__picker">
                                                <div className="admin-manual-week-picker">
                                                    <div className="admin-manual-week-picker__top">
                                                        <div className="admin-manual-week-picker__month">
                                                            <button
                                                                type="button"
                                                                onClick={openEditAppointmentMonthCalendar}
                                                                aria-label="Abrir calendário mensal"
                                                            >
                                                                📅
                                                            </button>

                                                            <strong>
                                                                {new Date(
                                                                    `${editWeekReferenceDate}T12:00:00`,
                                                                ).toLocaleDateString(
                                                                    "pt-BR",
                                                                    {
                                                                        month: "long",
                                                                        year: "numeric",
                                                                    },
                                                                )}
                                                            </strong>
                                                        </div>

                                                        <div className="admin-manual-week-picker__navs">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    moveEditAppointmentWeek(-1)
                                                                }
                                                                aria-label="Semana anterior"
                                                            >
                                                                ‹
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    moveEditAppointmentWeek(1)
                                                                }
                                                                aria-label="Próxima semana"
                                                            >
                                                                ›
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="admin-manual-week-days">
                                                        <div className="admin-manual-week-days__row admin-manual-week-days__row--four">
                                                            {editVisibleWeekDates
                                                                .slice(0, 4)
                                                                .map((date) => {
                                                                    const parsed =
                                                                        new Date(
                                                                            `${date}T12:00:00`,
                                                                        );
                                                                    const isPast =
                                                                        date <
                                                                        formatDateForInput(
                                                                            new Date(),
                                                                        );

                                                                    return (
                                                                        <button
                                                                            key={date}
                                                                            type="button"
                                                                            disabled={isPast}
                                                                            className={`admin-manual-week-day${
                                                                                editAppointmentDate ===
                                                                                date
                                                                                    ? " is-selected"
                                                                                    : ""
                                                                            }${
                                                                                isPast
                                                                                    ? " is-past"
                                                                                    : ""
                                                                            }`}
                                                                            onClick={() =>
                                                                                selectEditAppointmentDate(
                                                                                    date,
                                                                                )
                                                                            }
                                                                        >
                                                                            <span>
                                                                                {parsed
                                                                                    .toLocaleDateString(
                                                                                        "pt-BR",
                                                                                        {
                                                                                            weekday:
                                                                                                "short",
                                                                                        },
                                                                                    )
                                                                                    .replace(
                                                                                        ".",
                                                                                        "",
                                                                                    )}
                                                                            </span>
                                                                            <strong>
                                                                                {String(
                                                                                    parsed.getDate(),
                                                                                ).padStart(
                                                                                    2,
                                                                                    "0",
                                                                                )}
                                                                            </strong>
                                                                        </button>
                                                                    );
                                                                })}
                                                        </div>

                                                        <div className="admin-manual-week-days__row admin-manual-week-days__row--three">
                                                            {editVisibleWeekDates
                                                                .slice(4)
                                                                .map((date) => {
                                                                    const parsed =
                                                                        new Date(
                                                                            `${date}T12:00:00`,
                                                                        );
                                                                    const isPast =
                                                                        date <
                                                                        formatDateForInput(
                                                                            new Date(),
                                                                        );

                                                                    return (
                                                                        <button
                                                                            key={date}
                                                                            type="button"
                                                                            disabled={isPast}
                                                                            className={`admin-manual-week-day${
                                                                                editAppointmentDate ===
                                                                                date
                                                                                    ? " is-selected"
                                                                                    : ""
                                                                            }${
                                                                                isPast
                                                                                    ? " is-past"
                                                                                    : ""
                                                                            }`}
                                                                            onClick={() =>
                                                                                selectEditAppointmentDate(
                                                                                    date,
                                                                                )
                                                                            }
                                                                        >
                                                                            <span>
                                                                                {parsed
                                                                                    .toLocaleDateString(
                                                                                        "pt-BR",
                                                                                        {
                                                                                            weekday:
                                                                                                "short",
                                                                                        },
                                                                                    )
                                                                                    .replace(
                                                                                        ".",
                                                                                        "",
                                                                                    )}
                                                                            </span>
                                                                            <strong>
                                                                                {String(
                                                                                    parsed.getDate(),
                                                                                ).padStart(
                                                                                    2,
                                                                                    "0",
                                                                                )}
                                                                            </strong>
                                                                        </button>
                                                                    );
                                                                })}
                                                        </div>
                                                    </div>

                                                    {showEditMonthCalendar && (
                                                        <div className="admin-manual-month-calendar">
                                                            <div className="admin-manual-month-calendar__header">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setEditCalendarMonth(
                                                                            (current) =>
                                                                                new Date(
                                                                                    current.getFullYear(),
                                                                                    current.getMonth() -
                                                                                    1,
                                                                                    1,
                                                                                ),
                                                                        )
                                                                    }
                                                                >
                                                                    ‹
                                                                </button>

                                                                <strong>
                                                                    {editCalendarMonth.toLocaleDateString(
                                                                        "pt-BR",
                                                                        {
                                                                            month: "long",
                                                                            year: "numeric",
                                                                        },
                                                                    )}
                                                                </strong>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setEditCalendarMonth(
                                                                            (current) =>
                                                                                new Date(
                                                                                    current.getFullYear(),
                                                                                    current.getMonth() +
                                                                                    1,
                                                                                    1,
                                                                                ),
                                                                        )
                                                                    }
                                                                >
                                                                    ›
                                                                </button>
                                                            </div>

                                                            <div className="admin-manual-month-calendar__weekdays">
                                                                {[
                                                                    "SEG",
                                                                    "TER",
                                                                    "QUA",
                                                                    "QUI",
                                                                    "SEX",
                                                                    "SÁB",
                                                                    "DOM",
                                                                ].map((day) => (
                                                                    <span key={day}>
                                                                        {day}
                                                                    </span>
                                                                ))}
                                                            </div>

                                                            <div className="admin-manual-month-calendar__grid">
                                                                {getEditAppointmentMonthCells().map(
                                                                    (date, index) => {
                                                                        if (!date) {
                                                                            return (
                                                                                <span
                                                                                    className="is-empty"
                                                                                    key={`edit-empty-${index}`}
                                                                                />
                                                                            );
                                                                        }

                                                                        const isPast =
                                                                            date <
                                                                            formatDateForInput(
                                                                                new Date(),
                                                                            );

                                                                        return (
                                                                            <button
                                                                                type="button"
                                                                                key={date}
                                                                                disabled={isPast}
                                                                                className={`${
                                                                                    editAppointmentDate ===
                                                                                    date
                                                                                        ? "is-selected"
                                                                                        : ""
                                                                                }${
                                                                                    isPast
                                                                                        ? " is-past"
                                                                                        : ""
                                                                                }`}
                                                                                onClick={() =>
                                                                                    selectEditAppointmentDate(
                                                                                        date,
                                                                                    )
                                                                                }
                                                                            >
                                                                                {new Date(
                                                                                    `${date}T12:00:00`,
                                                                                ).getDate()}
                                                                            </button>
                                                                        );
                                                                    },
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="admin-edit-date-time__times">
                                                    <div className="admin-edit-date-time__times-heading">
                                                        <strong>Horários disponíveis</strong>
                                                        <span>
                                                            {editSelectedService
                                                                ? `${editSelectedService.duration_minutes} min`
                                                                : ""}
                                                        </span>
                                                    </div>

                                                    <div className="admin-manual-times">
                                                        {editAppointmentAvailableTimes.map(
                                                            (time) => (
                                                                <button
                                                                    key={time}
                                                                    type="button"
                                                                    className={
                                                                        editAppointmentTime ===
                                                                        time
                                                                            ? "is-selected"
                                                                            : ""
                                                                    }
                                                                    onClick={() => {
                                                                        setEditAppointmentTime(
                                                                            time,
                                                                        );
                                                                        setAppointmentEditError(
                                                                            "",
                                                                        );
                                                                    }}
                                                                >
                                                                    {time}
                                                                </button>
                                                            ),
                                                        )}
                                                    </div>

                                                    {!editAppointmentAvailableTimes.length && (
                                                        <div className="admin-manual-times__empty">
                                                            Nenhum horário disponível
                                                            para este serviço neste dia.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {appointmentEditError && <p className="admin-reschedule__message admin-edit-form__full">{appointmentEditError}</p>}
                                    <div className="admin-edit-actions">
                                        <button className="save" type="button" disabled={isSavingAppointment} onClick={() => void saveAppointmentChanges()}>{isSavingAppointment ? "Salvando..." : "Salvar alterações"}</button>
                                        <button className="cancel" type="button" onClick={() => void cancelAppointment(selectedAdminAppointment)}>Cancelar agendamento</button>
                                        <button className="close" type="button" onClick={() => setSelectedAdminAppointment(null)}>Fechar</button>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {selectedClient && (
                    <div className="admin-modal-backdrop" onMouseDown={(event) => {if (event.target === event.currentTarget) closeClientHistory();}}>
                        <section className="admin-client-history">
                            <button className="admin-modal__close" type="button" onClick={closeClientHistory}>×</button>
                            <h2>Histórico de {selectedClient.name}</h2>
                            <p>{selectedClient.phone} • {selectedClient.email || "E-mail não informado"}</p>

                            <section className="admin-client-history__section">
                                <div className="admin-client-history__section-header">
                                    <div>
                                        <h3>Registros das unhas</h3>
                                        <p>Fotos e observações ficam vinculadas ao perfil da cliente com data e hora do registro.</p>
                                    </div>
                                    <button
                                        className="admin-nail-record__new-button"
                                        type="button"
                                        onClick={() => {
                                            setShowNailRecordForm((current) => !current);
                                            setNailRecordError("");
                                            setNailRecordSuccess("");
                                        }}
                                    >
                                        {showNailRecordForm ? "Fechar registro" : "Registrar estado da unha"}
                                    </button>
                                </div>

                                {showNailRecordForm && (
                                    <div className="admin-nail-form">
                                        <div className="admin-nail-form__camera-actions">
                                            <label className="admin-nail-form__file-button is-camera">
                                                📷 Abrir câmera
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    onChange={handleNailCameraSelection}
                                                />
                                            </label>

                                            <label className="admin-nail-form__file-button">
                                                Escolher da galeria
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    multiple
                                                    onChange={handleNailCameraSelection}
                                                />
                                            </label>
                                        </div>

                                        <p className="admin-nail-form__hint">
                                            Você pode adicionar até 6 fotos por registro. No celular, “Abrir câmera” solicita a câmera traseira quando o navegador oferece suporte.
                                        </p>

                                        {nailRecordFilePreviews.length > 0 && (
                                            <div className="admin-nail-form__previews">
                                                {nailRecordFilePreviews.map((preview, index) => (
                                                    <div className="admin-nail-form__preview" key={`${preview.file.name}-${preview.file.lastModified}-${index}`}>
                                                        <img src={preview.url} alt={`Foto selecionada ${index + 1}`}/>
                                                        <button
                                                            type="button"
                                                            aria-label={`Remover foto ${index + 1}`}
                                                            onClick={() => removeNailRecordFile(index)}
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <label>
                                            <strong>Observação sobre a unha</strong>
                                            <textarea
                                                value={nailRecordNotes}
                                                onChange={(event) => setNailRecordNotes(event.target.value)}
                                                placeholder="Ex.: pequena fissura no indicador direito, unha fragilizada, descolamento pré-existente..."
                                                maxLength={1500}
                                            />
                                        </label>

                                        {nailRecordError && (
                                            <p className="admin-nail-form__message is-error">{nailRecordError}</p>
                                        )}

                                        <div className="admin-nail-form__actions">
                                            <button
                                                className="save"
                                                type="button"
                                                disabled={isSavingNailRecord}
                                                onClick={() => void saveNailRecord()}
                                            >
                                                {isSavingNailRecord ? "Salvando registro..." : "Salvar registro"}
                                            </button>
                                            <button
                                                className="cancel"
                                                type="button"
                                                disabled={isSavingNailRecord}
                                                onClick={resetNailRecordForm}
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {nailRecordSuccess && (
                                    <p className="admin-nail-form__message is-success">{nailRecordSuccess}</p>
                                )}

                                {isLoadingNailRecords ? (
                                    <div className="admin-nail-records__loading">Carregando registros das unhas...</div>
                                ) : nailRecords.length ? (
                                    <div className="admin-nail-records">
                                        {nailRecords.map((record) => (
                                            <article className="admin-nail-record" key={record.id}>
                                                <div className="admin-nail-record__top">
                                                    <strong>Registro fotográfico</strong>
                                                    <div className="admin-nail-record__top-actions">
                                                        <span>
                                                            {new Date(record.created_at).toLocaleString("pt-BR", {
                                                                day: "2-digit",
                                                                month: "2-digit",
                                                                year: "numeric",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="admin-nail-record__delete"
                                                            disabled={deletingNailRecordId === record.id}
                                                            onClick={() => void deleteNailRecord(record)}
                                                        >
                                                            {deletingNailRecordId === record.id ? "Excluindo..." : "Excluir"}
                                                        </button>
                                                    </div>
                                                </div>

                                                <p className="admin-nail-record__notes">
                                                    {record.notes || "Sem observação informada."}
                                                </p>

                                                {record.photos.length > 0 && (
                                                    <div className="admin-nail-record__photos">
                                                        {record.photos.map((photo, index) =>
                                                            photo.signedUrl ? (
                                                                <a
                                                                    key={photo.id}
                                                                    href={photo.signedUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    title="Abrir foto em tamanho maior"
                                                                >
                                                                    <img
                                                                        src={photo.signedUrl}
                                                                        alt={`Registro da unha ${index + 1}`}
                                                                    />
                                                                </a>
                                                            ) : null,
                                                        )}
                                                    </div>
                                                )}
                                            </article>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="admin-nail-records__empty">
                                        Nenhum registro da unha salvo para esta cliente.
                                    </div>
                                )}
                            </section>

                            <section className="admin-client-history__section">
                                <div className="admin-client-history__section-header">
                                    <div>
                                        <h3>Histórico de atendimentos</h3>
                                        <p>Agendamentos registrados para esta cliente.</p>
                                    </div>
                                </div>

                                <div className="admin-client-history__list">
                                    {selectedClient.appointments.map((appointment) => {
                                        const canClear =
                                            appointment.status === "cancelled";
                                        const isClearing =
                                            clearingCancelledAppointmentId ===
                                            appointment.id;

                                        return (
                                            <article
                                                key={appointment.id}
                                                className={[
                                                    canClear
                                                        ? "is-cancelled-cleanable"
                                                        : "",
                                                    isClearing
                                                        ? "is-clearing"
                                                        : "",
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ")}
                                                role={
                                                    canClear
                                                        ? "button"
                                                        : undefined
                                                }
                                                tabIndex={
                                                    canClear ? 0 : undefined
                                                }
                                                onClick={() => {
                                                    if (canClear) {
                                                        void clearCancelledAppointmentFromHistory(
                                                            appointment,
                                                        );
                                                    }
                                                }}
                                                onKeyDown={(event) => {
                                                    if (
                                                        canClear &&
                                                        (event.key === "Enter" ||
                                                            event.key === " ")
                                                    ) {
                                                        event.preventDefault();
                                                        void clearCancelledAppointmentFromHistory(
                                                            appointment,
                                                        );
                                                    }
                                                }}
                                            >
                                                <div>
                                                    <strong>
                                                        {
                                                            appointment.service_name
                                                        }
                                                    </strong>
                                                    <span>
                                                        {formatAdminDate(
                                                            appointment.appointment_date,
                                                        )}{" "}
                                                        às{" "}
                                                        {String(
                                                            appointment.start_time,
                                                        ).slice(0, 5)}
                                                    </span>
                                                </div>

                                                {canClear ? (
                                                    <div className="admin-client-history__cancelled-action">
                                                        <strong>
                                                            {isClearing
                                                                ? "Limpando..."
                                                                : "Cancelado"}
                                                        </strong>
                                                        <small>
                                                            Toque para limpar
                                                        </small>
                                                    </div>
                                                ) : (
                                                    <span>
                                                        {getAppointmentStatusLabel(
                                                            appointment.status,
                                                        )}
                                                    </span>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        </section>
                    </div>
                )}

                {editingClient && (
                    <div className="admin-modal-backdrop" onMouseDown={(event) => {if (event.target === event.currentTarget) setEditingClient(null);}}>
                        <section className="admin-client-editor">
                            <button className="admin-modal__close" type="button" onClick={() => setEditingClient(null)}>×</button>
                            <h2>Editar cadastro</h2>
                            <label>Nome<input value={editClientName} onChange={(event) => setEditClientName(event.target.value)}/></label>
                            <label>Telefone<input value={editClientPhone} onChange={(event) => setEditClientPhone(formatBrazilianPhone(event.target.value))} maxLength={15} inputMode="numeric"/></label>
                            <label>E-mail<input type="email" value={editClientEmail} onChange={(event) => setEditClientEmail(event.target.value)}/></label>
                            <label>
                                Gosto musical
                                <textarea
                                    value={editClientMusicTaste}
                                    onChange={(event) => setEditClientMusicTaste(event.target.value)}
                                    placeholder="Ex.: pagode, sertanejo, pop, anos 80..."
                                    rows={3}
                                    maxLength={500}
                                />
                            </label>

                            <section className="admin-anamnesis-card">
                                <div className="admin-anamnesis-card__header">
                                    <div>
                                        <span>Saúde e cuidados</span>
                                        <h3>Ficha de anamnese</h3>
                                    </div>
                                </div>

                                {isLoadingClientAnamnesis ? (
                                    <p className="admin-anamnesis-card__loading">
                                        Carregando ficha...
                                    </p>
                                ) : (
                                    <div className="admin-anamnesis-card__questions">
                                        <label>
                                            <span>1. Data de nascimento</span>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={clientAnamnesis.birthDate}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "birthDate",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: 15/08/1990"
                                                maxLength={10}
                                            />
                                        </label>

                                        <label>
                                            <span>2. Indicação</span>
                                            <input
                                                value={clientAnamnesis.referral}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "referral",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Digite a resposta"
                                            />
                                        </label>

                                        <label>
                                            <span>3. É gestante?</span>
                                            <input
                                                value={clientAnamnesis.pregnant}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "pregnant",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>4. Tem diabetes?</span>
                                            <input
                                                value={clientAnamnesis.diabetes}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "diabetes",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>5. É bariátrica?</span>
                                            <input
                                                value={clientAnamnesis.bariatric}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "bariatric",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>6. Faz quimioterapia?</span>
                                            <input
                                                value={clientAnamnesis.chemotherapy}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "chemotherapy",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>7. Tireoide</span>
                                            <input
                                                value={clientAnamnesis.thyroid}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "thyroid",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Digite a resposta"
                                            />
                                        </label>

                                        <label>
                                            <span>8. Tem o hábito de roer as unhas?</span>
                                            <input
                                                value={clientAnamnesis.nailBiting}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "nailBiting",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>9. Tem alergias?</span>
                                            <input
                                                value={clientAnamnesis.allergies}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "allergies",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Informe quais, se houver"
                                            />
                                        </label>

                                        <label>
                                            <span>10. Tem micose?</span>
                                            <input
                                                value={clientAnamnesis.mycosis}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "mycosis",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>

                                        <label>
                                            <span>11. Usa medicamentos contínuos?</span>
                                            <input
                                                value={clientAnamnesis.continuousMedication}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "continuousMedication",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Informe quais, se houver"
                                            />
                                        </label>

                                        <label>
                                            <span>12. Usa materiais de limpeza?</span>
                                            <input
                                                value={clientAnamnesis.cleaningProducts}
                                                onChange={(event) =>
                                                    updateClientAnamnesisField(
                                                        "cleaningProducts",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ex.: Sim / Não"
                                            />
                                        </label>
                                    </div>
                                )}
                            </section>

                            {clientEditError && <p className="admin-reschedule__message">{clientEditError}</p>}
                            <button className="admin-primary-button" type="button" disabled={isSavingClient} onClick={() => void saveClientChanges()}>{isSavingClient ? "Salvando..." : "Salvar cadastro"}</button>
                        </section>
                    </div>
                )}
            </section>
        </main>
    );
}


function App() {
    const normalizedPath = window.location.pathname.replace(/\/+$/, "");

    if (normalizedPath === "/admin") {
        return <AdminPanel/>;
    }

    return <PublicSite/>;
}

export default App;
