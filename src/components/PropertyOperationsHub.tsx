type Operations = {
  access?: string;
  wifiName?: string;
  wifiPassword?: string;
  trashInstructions?: string;
  cleanerNotes?: string;
};

type Props = {
  property: any;
  onChange: any;
};

const blankOperations: Operations = {
  access: "",
  wifiName: "",
  wifiPassword: "",
  trashInstructions: "",
  cleanerNotes: "",
};

export default function PropertyOperationsHub({ property, onChange }: Props) {
  const operations = property.operations ?? blankOperations;

  function updateOperation(field: keyof Operations, value: string) {
    onChange({
      ...property,
      operations: {
        ...operations,
        [field]: value,
      },
    });
  }

  return (
    <section className="manualPanel fullWidth">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Property Operations Hub</p>
          <h3>Cleaner Property Info</h3>
          <p className="mutedText">
            This information appears inside the Cleaner Portal for assigned cleanings.
          </p>
        </div>
      </div>

      <label className="fullWidth">
        Access Instructions
        <textarea
          value={operations.access ?? ""}
          onChange={(event) => updateOperation("access", event.target.value)}
          placeholder="Door code, lockbox, gate code, parking, entry notes"
        />
      </label>

      <label>
        WiFi Name
        <input
          value={operations.wifiName ?? ""}
          onChange={(event) => updateOperation("wifiName", event.target.value)}
          placeholder="WiFi network name"
        />
      </label>

      <label>
        WiFi Password
        <input
          value={operations.wifiPassword ?? ""}
          onChange={(event) => updateOperation("wifiPassword", event.target.value)}
          placeholder="WiFi password"
        />
      </label>

      <label className="fullWidth">
        Trash Instructions
        <textarea
          value={operations.trashInstructions ?? ""}
          onChange={(event) => updateOperation("trashInstructions", event.target.value)}
          placeholder="Trash day, bin location, dumpster rules"
        />
      </label>

      <label className="fullWidth">
        Cleaner Notes
        <textarea
          value={operations.cleanerNotes ?? ""}
          onChange={(event) => updateOperation("cleanerNotes", event.target.value)}
          placeholder="Property-specific cleaner notes"
        />
      </label>
    </section>
  );
}