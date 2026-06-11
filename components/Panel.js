export default function Panel({ kicker, title, sub, children, className = '', style }) {
  return (
    <div className={`panel ${className}`} style={style}>
      <span className="panel-corner tl" />
      <span className="panel-corner br" />
      {(kicker || title) && (
        <div className="panel-head">
          {kicker && <span className="panel-kicker">{kicker}</span>}
          {title && <span className="panel-title">{title}</span>}
          {sub && <span className="panel-sub">{sub}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
