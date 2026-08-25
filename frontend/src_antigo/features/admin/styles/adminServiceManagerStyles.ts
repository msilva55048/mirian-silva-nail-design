export const adminServiceManagerStyles = `
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
