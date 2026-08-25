export const clientAccountStyles = `
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
    display: grid;
    grid-template-columns: repeat(auto-fit, 76px);
    justify-content: center;
    gap: 6px;
}
.client-week-times .booking-time {
    width: 76px;
    min-width: 76px;
    max-width: 76px;
    min-height: 36px;
    padding: 9px 8px;
    border-radius: 10px;
    font-size: .82rem;
    box-sizing: border-box;
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

.client-forgot-password {
    justify-self: end;
    margin-top: -4px;
    border: 0;
    padding: 2px 0;
    background: transparent;
    color: #8b485d;
    font: inherit;
    font-size: .82rem;
    font-weight: 850;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
}

.client-recovery-actions {
    display: grid;
    gap: 9px;
}

.client-recovery-secondary {
    border: 1px solid #dbc5cc;
    border-radius: 12px;
    padding: 12px 15px;
    background: #fff;
    color: #6d3445;
    font: inherit;
    font-weight: 850;
    cursor: pointer;
}

.client-recovery-secondary:disabled {
    opacity: .55;
    cursor: wait;
}

.client-recovery-success-actions {
    display: grid;
    gap: 9px;
    margin-top: 4px;
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
