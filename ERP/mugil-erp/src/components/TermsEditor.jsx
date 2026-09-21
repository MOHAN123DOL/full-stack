export default function TermsEditor({ mode = 'form', terms, onChange }) {
  if (mode === 'print') {
    return (
      <ol className="doc-numbered">
        {terms.filter((t) => t.trim()).map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>
    );
  }

  const update = (idx, value) => {
    const next = [...terms];
    next[idx] = value;
    onChange(next);
  };

  const addTerm = () => onChange([...terms, '']);

  const removeTerm = (idx) => {
    if (terms.length === 1) return;
    onChange(terms.filter((_, i) => i !== idx));
  };

  const move = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= terms.length) return;
    const next = [...terms];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="terms-list">
      {terms.map((term, idx) => (
        <div className="terms-list__item" key={idx}>
          <span className="terms-list__index">{idx + 1}.</span>
          <input
            className="field__input"
            value={term}
            onChange={(e) => update(idx, e.target.value)}
            placeholder="Enter term or condition"
          />
          <div className="terms-list__reorder">
            <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} title="Move up">▲</button>
            <button type="button" onClick={() => move(idx, 1)} disabled={idx === terms.length - 1} title="Move down">▼</button>
          </div>
          <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeTerm(idx)} disabled={terms.length === 1} title="Delete">✕</button>
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm terms-list__add" onClick={addTerm}>+ Add Term</button>
    </div>
  );
}
