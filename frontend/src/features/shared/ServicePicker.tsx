import {useEffect, useRef, useState} from "react";

type ServiceOption = {id: number; name: string};

type Props = {
  services: ServiceOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
};

export function ServicePicker({services, value, onChange, placeholder = "Selecione o serviço", label}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = services.find((service) => String(service.id) === value);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return <div className="service-picker" ref={ref}>
    {label && <span className="service-picker__label">{label}</span>}
    <button type="button" className="service-picker__trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span>{selected?.name ?? placeholder}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <div className="service-picker__menu" role="listbox" aria-label={label ?? "Serviço"}>
      {services.map((service) => <button type="button" role="option" aria-selected={String(service.id) === value} className={String(service.id) === value ? "is-selected" : ""} key={service.id} onClick={() => { onChange(String(service.id)); setOpen(false); }}>{service.name}</button>)}
    </div>}
    <style>{`.service-picker{position:relative;display:grid;gap:7px;min-width:0}.service-picker__label{font-size:.84rem;font-weight:750;color:#6d3445}.service-picker__trigger{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #d8c7cc;border-radius:11px;padding:11px 12px;background:#fff;color:#4d363e;font:inherit;text-align:left;cursor:pointer}.service-picker__trigger span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.service-picker__menu{position:absolute;z-index:20;top:calc(100% + 5px);left:0;right:0;display:grid;gap:3px;padding:6px;border:1px solid #dbc5cc;border-radius:12px;background:#fff;box-shadow:0 12px 28px rgba(86,48,62,.16);max-height:260px;overflow:auto}.service-picker__menu button{border:0;border-radius:8px;padding:10px;background:transparent;color:#5d464d;font:inherit;text-align:left;cursor:pointer}.service-picker__menu button:hover,.service-picker__menu button.is-selected{background:#f7e9ed;color:#6d3445;font-weight:800}`}</style>
  </div>;
}
