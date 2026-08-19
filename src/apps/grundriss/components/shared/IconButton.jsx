export default function IconButton({ label, icon, active = false, danger = false, onClick, disabled = false }) {
  const classNames = ["icon-button"];
  if (active) classNames.push("icon-button--active");
  if (danger) classNames.push("icon-button--danger");

  return (
    <button
      type="button"
      className={classNames.join(" ")}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-pressed={active}
    >
      <span className="icon-button__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="icon-button__label">{label}</span>
    </button>
  );
}
