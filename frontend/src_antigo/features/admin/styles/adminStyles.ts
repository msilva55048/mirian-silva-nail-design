export const adminStyles = `
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

.admin-client-history__list article.is-confirmed-deletable {
    cursor: pointer;
    border-color: rgba(61, 117, 83, .22);
    background: #f8fcf9;
    transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
}

.admin-client-history__list article.is-confirmed-deletable:hover {
    transform: translateY(-1px);
    border-color: rgba(61, 117, 83, .4);
    box-shadow: 0 8px 20px rgba(83, 48, 58, .08);
}

.admin-client-history__list article.is-confirmed-deletable:focus-visible {
    outline: 3px solid rgba(61, 117, 83, .16);
    outline-offset: 2px;
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

.admin-client-history__confirmed-action {
    display: grid;
    gap: 3px;
    text-align: right;
}

.admin-client-history__confirmed-action strong {
    color: #2f7750;
    font-size: .78rem;
}

.admin-client-history__confirmed-action small {
    color: #72867a;
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
