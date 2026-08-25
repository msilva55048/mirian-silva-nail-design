export const adminEnhancementStyles = `
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

.admin-active-content-anchor {
    height: 1px;
    scroll-margin-top: 16px;
}

.admin-back-to-top {
    position: fixed;
    right: 14px;
    bottom: 18px;
    z-index: 120;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 1px solid rgba(109, 52, 69, .20);
    border-radius: 50%;
    background: linear-gradient(135deg, #7c4356, #a95470);
    color: #fff;
    box-shadow: 0 8px 22px rgba(83, 48, 58, .22);
    font: inherit;
    font-size: 1.35rem;
    font-weight: 900;
    line-height: 1;
    cursor: pointer;
    transition:
        transform .16s ease,
        opacity .16s ease,
        box-shadow .16s ease;
}

.admin-back-to-top:hover {
    transform: translateY(-2px);
    box-shadow: 0 11px 26px rgba(83, 48, 58, .28);
}

.admin-back-to-top:focus-visible {
    outline: 3px solid rgba(154, 83, 104, .24);
    outline-offset: 3px;
}

@media (max-width: 560px) {
    .admin-back-to-top {
        right: 12px;
        bottom: 14px;
        width: 42px;
        height: 42px;
        font-size: 1.25rem;
    }
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

.admin-month-agenda {
    display: grid;
    gap: 18px;
    margin-top: 18px;
    padding: 22px;
    border: 1px solid rgba(154, 97, 115, .16);
    border-radius: 24px;
    background: rgba(255,255,255,.96);
    box-shadow: 0 16px 40px rgba(92,56,67,.07);
}
.admin-month-agenda__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
}
.admin-month-agenda__header > div:first-child {
    display: grid;
    gap: 4px;
}
.admin-month-agenda__header span {
    color: #9a5d70;
    font-size: .74rem;
    font-weight: 900;
    letter-spacing: .08em;
    text-transform: uppercase;
}
.admin-month-agenda__header strong {
    color: #402f35;
    font-size: 1.22rem;
    text-transform: capitalize;
}
.admin-month-agenda__nav {
    display: flex;
    align-items: center;
    gap: 8px;
}
.admin-month-agenda__nav button {
    min-width: 42px;
    height: 42px;
    border: 1px solid #dbc5cc;
    border-radius: 12px;
    background: #fff;
    color: #6d3445;
    font: inherit;
    font-weight: 900;
    cursor: pointer;
}
.admin-month-agenda__today {
    padding: 0 13px;
    width: auto !important;
}
.admin-month-agenda__days {
    display: grid;
    gap: 16px;
}
.admin-month-agenda__day {
    display: grid;
    gap: 9px;
}
.admin-month-agenda__day-header {
    display: flex;
    align-items: center;
    gap: 10px;
}
.admin-month-agenda__day-header strong {
    color: #5b3c47;
    font-size: .95rem;
}
.admin-month-agenda__day-header::after {
    content: "";
    flex: 1;
    height: 1px;
    background: #eadde1;
}
@media (max-width: 650px) {
    .admin-month-agenda {
        padding: 16px;
    }
    .admin-month-agenda__header {
        align-items: flex-start;
        flex-direction: column;
    }
    .admin-month-agenda__nav {
        width: 100%;
        justify-content: flex-end;
    }
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
    border: 1px solid #e0c7cf;
    border-left: 6px solid #8b485d;
    background: #fffafb;
    color: #35272c;
    box-shadow: 0 9px 26px rgba(83, 48, 58, 0.07);
}
.admin-top-agenda .admin-booking-card:hover {
    box-shadow: 0 13px 32px rgba(83, 48, 58, 0.10);
}
.admin-top-agenda .admin-booking-card h3 {
    color: #302126;
}
.admin-top-agenda .admin-booking-card__time {
    color: #8b485d;
}
.admin-top-agenda .admin-booking-card__details strong {
    color: #50373f;
}
.admin-top-agenda .admin-booking-card__details div {
    background: #f8eef1;
}
.admin-top-agenda .admin-booking-card__details span {
    color: #80666e;
}
.admin-top-agenda .admin-booking-card.is-cancelled {
    border-left-color: #aaa0a4;
    background: #f7f4f5;
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
