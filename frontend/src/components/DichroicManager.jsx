import React, { useState } from "react";

export default function DichroicManager({ dichroics, setDichroics }) {
  // UI for adding/editing dichroic mirrors
  const [name, setName] = useState("");
  const [cutoff, setCutoff] = useState(500);

  const handleAdd = () => {
    if (!name) return;
    setDichroics([
      ...dichroics,
      { name, cutoff: Number(cutoff) }
    ]);
    setName("");
    setCutoff(500);
  };

  return (
    <div>
      <h2>Dichroic Mirrors</h2>
      <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
      <input type="number" value={cutoff} onChange={e => setCutoff(e.target.value)} />
      <button onClick={handleAdd}>Add Dichroic</button>
      <ul>
        {dichroics.map((d, i) => (
          <li key={i}>
            {d.name} (cutoff: {d.cutoff} nm)
            <button onClick={() => setDichroics(dichroics.filter((_, j) => j !== i))}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
