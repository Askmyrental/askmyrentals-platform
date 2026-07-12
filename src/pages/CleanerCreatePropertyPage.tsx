import { useState } from "react";

export type CleanerPropertyFormValues = {
  propertyName: string;
  propertyPhotoUrl: string;
  address: string;
  city: string;
  bedrooms: string;
  bathrooms: string;
  kitchens: string;
  floors: string;
  kingBeds: string;
  queenBeds: string;
  doubleBeds: string;
  twinBeds: string;
  bunkBeds: string;
  pyramidBunks: string;
  murphyBeds: string;
  sofaSleepers: string;
  cleaningFee: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  accessInstructions: string;
  wifiName: string;
  wifiPassword: string;
  parkingInstructions: string;
  trashInstructions: string;
  supplyLocations: string;
  privateCleanerNotes: string;
};

type CleanerCreatePropertyPageProps = {
  onCancel: () => void;
  onSubmit: (values: CleanerPropertyFormValues) => Promise<void>;
  isSaving?: boolean;
  initialValues?: CleanerPropertyFormValues;
  mode?: "create" | "edit";
};

const countOptions = ["0", "1", "2", "3", "4", "5", "6"];

const initialValues: CleanerPropertyFormValues = {
  propertyName: "",
  propertyPhotoUrl: "",
  address: "",
  city: "",
  bedrooms: "0",
  bathrooms: "0",
  kitchens: "1",
  floors: "1",
  kingBeds: "0",
  queenBeds: "0",
  doubleBeds: "0",
  twinBeds: "0",
  bunkBeds: "0",
  pyramidBunks: "0",
  murphyBeds: "0",
  sofaSleepers: "0",
  cleaningFee: "",
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
  accessInstructions: "",
  wifiName: "",
  wifiPassword: "",
  parkingInstructions: "",
  trashInstructions: "",
  supplyLocations: "",
  privateCleanerNotes: "",
};

export default function CleanerCreatePropertyPage({
  onCancel,
  onSubmit,
  isSaving = false,
  initialValues: providedInitialValues,
  mode = "create",
}: CleanerCreatePropertyPageProps) {
  const [form, setForm] = useState<CleanerPropertyFormValues>(
    providedInitialValues ?? initialValues
  );
  const [error, setError] = useState("");

  function updateField(
    field: keyof CleanerPropertyFormValues,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function renderCountSelect(
    label: string,
    field: keyof CleanerPropertyFormValues
  ) {
    return (
      <label className="cleanerCreatePropertyField cleanerBedCountField">
        {label}
        <select
          value={form[field]}
          onChange={(event) => updateField(field, event.target.value)}
        >
          {countOptions.map((count) => (
            <option key={count} value={count}>
              {count === "6" ? "6+" : count}
            </option>
          ))}
        </select>
      </label>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.propertyName.trim()) {
      setError("Add a property name before continuing.");
      return;
    }

    if (!form.ownerName.trim()) {
      setError("Add the homeowner's name before continuing.");
      return;
    }

    if (!form.ownerEmail.trim() && !form.ownerPhone.trim()) {
      setError(
        "Add at least one homeowner contact method: an email address or phone number."
      );
      return;
    }

    setError("");

    try {
      await onSubmit(form);
    } catch (submitError) {
      console.error("Cleaner property creation failed", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The property could not be created."
      );
    }
  }

  return (
    <main className="cleanerCreatePropertyPage">
      <button
        className="cleanerPropertyDetailBackButton"
        type="button"
        onClick={onCancel}
        disabled={isSaving}
      >
        {mode === "edit" ? "← Back to Property" : "← Back to Properties"}
      </button>

      <header className="cleanerCreatePropertyHeader">
        <div>
          <p className="cleanerPropertiesEyebrow">
            {mode === "edit" ? "Property Settings" : "Property Onboarding"}
          </p>
          <h1>{mode === "edit" ? "Edit Property" : "Create a Property"}</h1>
          <p>
            {mode === "edit"
              ? "Update the home, cleaning workload, homeowner contact, and access details."
              : "Add the home, the cleaning workload, and the homeowner contact information. Calendar access will be requested after the property is saved."}
          </p>
        </div>

        <div className="cleanerCreatePropertyStepBadge">
          <strong>Cleaner setup</strong>
          <span>Built around the work inside the home</span>
        </div>
      </header>

      <form className="cleanerCreatePropertyForm" onSubmit={handleSubmit}>
        <section className="cleanerCreatePropertySection">
          <div className="cleanerCreatePropertySectionHeader">
            <div>
              <p className="cleanerPropertyCardLabel">Property</p>
              <h2>Home information</h2>
            </div>
            <span>Required</span>
          </div>

          <div className="cleanerCreatePropertyFields">
            <label className="cleanerCreatePropertyField">
              Property name
              <input
                value={form.propertyName}
                onChange={(event) =>
                  updateField("propertyName", event.target.value)
                }
                placeholder="Example: Gulf Front Retreat"
                autoFocus
              />
            </label>

            <label className="cleanerCreatePropertyField">
              Property photo URL
              <input
                value={form.propertyPhotoUrl}
                onChange={(event) =>
                  updateField("propertyPhotoUrl", event.target.value)
                }
                placeholder="Optional image URL"
              />
            </label>

            <label className="cleanerCreatePropertyField cleanerCreatePropertyFieldWide">
              Street address
              <input
                value={form.address}
                onChange={(event) =>
                  updateField("address", event.target.value)
                }
                placeholder="123 Beach Avenue"
              />
            </label>

            <label className="cleanerCreatePropertyField">
              City / market
              <input
                value={form.city}
                onChange={(event) => updateField("city", event.target.value)}
                placeholder="Destin, FL"
              />
            </label>

            <label className="cleanerCreatePropertyField">
              Standard cleaning fee
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.cleaningFee}
                onChange={(event) =>
                  updateField("cleaningFee", event.target.value)
                }
                placeholder="185"
              />
            </label>
          </div>
        </section>

        <section className="cleanerCreatePropertySection">
          <div className="cleanerCreatePropertySectionHeader">
            <div>
              <p className="cleanerPropertyCardLabel">Cleaning Workload</p>
              <h2>Home setup</h2>
            </div>
            <span>Cleaner focused</span>
          </div>

          <div className="cleanerCreatePropertyFields cleanerHomeSetupFields">
            {renderCountSelect("Bedrooms", "bedrooms")}
            {renderCountSelect("Bathrooms", "bathrooms")}
            {renderCountSelect("Kitchens", "kitchens")}
            {renderCountSelect("Floors", "floors")}
          </div>

          <div className="cleanerBeddingSection">
            <div>
              <p className="cleanerPropertyCardLabel">Bedding</p>
              <h3>Bed quantities</h3>
              <p>
                Use these counts to remember which sheets and bedding are
                needed for each turnover.
              </p>
            </div>

            <div className="cleanerBeddingGrid">
              {renderCountSelect("King", "kingBeds")}
              {renderCountSelect("Queen", "queenBeds")}
              {renderCountSelect("Double", "doubleBeds")}
              {renderCountSelect("Twin", "twinBeds")}
              {renderCountSelect("Bunk", "bunkBeds")}
              {renderCountSelect("Pyramid bunk", "pyramidBunks")}
              {renderCountSelect("Murphy bed", "murphyBeds")}
              {renderCountSelect("Sofa sleeper", "sofaSleepers")}
            </div>
          </div>
        </section>

        <section className="cleanerCreatePropertySection cleanerOwnerContactSection">
          <div className="cleanerCreatePropertySectionHeader">
            <div>
              <p className="cleanerPropertyCardLabel">Homeowner Contact</p>
              <h2>Who should receive the calendar request?</h2>
            </div>
            <span>Required</span>
          </div>

          <div className="cleanerOwnerContactNotice">
            <span>📨</span>
            <p>
              After the property is saved, you can request the reservation
              calendar by email, text message, or a copied request message.
            </p>
          </div>

          <div className="cleanerCreatePropertyFields">
            <label className="cleanerCreatePropertyField">
              Homeowner name
              <input
                value={form.ownerName}
                onChange={(event) =>
                  updateField("ownerName", event.target.value)
                }
                placeholder="Homeowner name"
              />
            </label>

            <label className="cleanerCreatePropertyField">
              Homeowner email
              <input
                type="email"
                value={form.ownerEmail}
                onChange={(event) =>
                  updateField("ownerEmail", event.target.value)
                }
                placeholder="owner@example.com"
              />
            </label>

            <label className="cleanerCreatePropertyField">
              Homeowner phone
              <input
                type="tel"
                value={form.ownerPhone}
                onChange={(event) =>
                  updateField("ownerPhone", event.target.value)
                }
                placeholder="(555) 555-5555"
              />
            </label>
          </div>

          <p className="cleanerCreatePropertyHelp">
            An email address or phone number is required. Adding both gives the
            cleaner more ways to reach the homeowner.
          </p>
        </section>

        <section className="cleanerCreatePropertySection">
          <div className="cleanerCreatePropertySectionHeader">
            <div>
              <p className="cleanerPropertyCardLabel">Operations</p>
              <h2>Cleaning and access details</h2>
            </div>
            <span>Private</span>
          </div>

          <div className="cleanerCreatePropertyFields">
            <label className="cleanerCreatePropertyField cleanerCreatePropertyFieldWide">
              Door code / access instructions
              <textarea
                value={form.accessInstructions}
                onChange={(event) =>
                  updateField("accessInstructions", event.target.value)
                }
                placeholder="Front door keypad, lockbox location, gate code..."
              />
            </label>

            <label className="cleanerCreatePropertyField">
              Wi-Fi name
              <input
                value={form.wifiName}
                onChange={(event) =>
                  updateField("wifiName", event.target.value)
                }
                placeholder="Network name"
              />
            </label>

            <label className="cleanerCreatePropertyField">
              Wi-Fi password
              <input
                value={form.wifiPassword}
                onChange={(event) =>
                  updateField("wifiPassword", event.target.value)
                }
                placeholder="Wi-Fi password"
              />
            </label>

            <label className="cleanerCreatePropertyField cleanerCreatePropertyFieldWide">
              Parking instructions
              <textarea
                value={form.parkingInstructions}
                onChange={(event) =>
                  updateField("parkingInstructions", event.target.value)
                }
                placeholder="Optional parking details or restrictions"
              />
            </label>

            <label className="cleanerCreatePropertyField cleanerCreatePropertyFieldWide">
              Trash instructions
              <textarea
                value={form.trashInstructions}
                onChange={(event) =>
                  updateField("trashInstructions", event.target.value)
                }
                placeholder="Trash day, bin location, disposal instructions"
              />
            </label>

            <label className="cleanerCreatePropertyField cleanerCreatePropertyFieldWide">
              Supply locations
              <textarea
                value={form.supplyLocations}
                onChange={(event) =>
                  updateField("supplyLocations", event.target.value)
                }
                placeholder="Linens, paper goods, cleaning supplies..."
              />
            </label>

            <label className="cleanerCreatePropertyField cleanerCreatePropertyFieldWide">
              Private cleaner notes
              <textarea
                value={form.privateCleanerNotes}
                onChange={(event) =>
                  updateField("privateCleanerNotes", event.target.value)
                }
                placeholder="Unusual beds, outdoor areas, pool details, or anything else the cleaner should remember"
              />
            </label>
          </div>
        </section>

        {error && <p className="cleanerCreatePropertyError">{error}</p>}

        <div className="cleanerCreatePropertyActions">
          <button
            className="cleanerCreatePropertyCancelButton"
            type="button"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </button>

          <button
            className="cleanerCreatePropertySubmitButton"
            type="submit"
            disabled={isSaving}
          >
            {isSaving
              ? mode === "edit"
                ? "Saving Changes..."
                : "Saving Property..."
              : mode === "edit"
                ? "Save Changes"
                : "Save Property"}
          </button>
        </div>
      </form>
    </main>
  );
}