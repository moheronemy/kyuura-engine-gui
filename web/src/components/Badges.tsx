import { DISCLOSURE_TEXT, PROCESSABILITY_TEXT } from "../labels";

export function ProcessabilityBadge({ value, withDescription = false }: { value: string; withDescription?: boolean }) {
  const text = PROCESSABILITY_TEXT[value];
  return (
    <span className={`badge proc-${value}`} title={text?.description ?? value}>
      <span className="badge-label">{text?.label ?? value}</span>
      <code className="badge-code">{value}</code>
      {withDescription && text ? <span className="badge-desc">{text.description}</span> : null}
    </span>
  );
}

export function DisclosureBadge({ value }: { value: string }) {
  const text = DISCLOSURE_TEXT[value];
  return (
    <span className={`badge disclosure-${value}`} title={text?.description ?? value}>
      <span className="badge-label">{text?.label ?? value}</span>
      <code className="badge-code">input_disclosure: {value}</code>
    </span>
  );
}
