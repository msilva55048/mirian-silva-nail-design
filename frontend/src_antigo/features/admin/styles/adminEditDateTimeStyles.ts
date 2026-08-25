export const adminEditDateTimeStyles = `
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
