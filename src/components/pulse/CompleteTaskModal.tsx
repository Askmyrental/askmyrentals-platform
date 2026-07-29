import { useEffect, useState, type FormEvent } from "react";

export type CompleteTaskResult = {
  guestReady: boolean;
  notes: string;
  includePhotos: boolean;
  photos: File[];
  maintenanceReported: boolean;
  maintenanceTitle: string;
  maintenanceDescription: string;
  maintenanceUrgency: "Low" | "Medium" | "High";
  maintenancePhotos: File[];
  cleaningFee: string;
};

type CompleteTaskModalProps = {
  task: any;
  home: any;
  onClose: () => void;
  onUndoStart: () => void;
  onSaveDraft: (result: CompleteTaskResult) => void;
  onFinish: (result: CompleteTaskResult) => void;
};

export default function CompleteTaskModal({
  task,
  home,
  onClose,
  onUndoStart,
  onSaveDraft,
  onFinish,
}: CompleteTaskModalProps) {
  const [guestReady, setGuestReady] = useState<"yes" | "no">("yes");
  const [notes, setNotes] = useState("");
  const [includePhotos, setIncludePhotos] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [maintenanceChoice, setMaintenanceChoice] = useState<
    "none" | "issue"
  >("none");
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceDescription, setMaintenanceDescription] =
    useState("");
  const [maintenanceUrgency, setMaintenanceUrgency] = useState<
    "Low" | "Medium" | "High"
  >("Medium");
  const [maintenancePhotos, setMaintenancePhotos] = useState<File[]>([]);
  const [cleaningFee, setCleaningFee] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const savedDraft = task?.completionDraft;

    setGuestReady(savedDraft?.guestReady === false ? "no" : "yes");
    setNotes(savedDraft?.notes ?? "");
    setIncludePhotos(Boolean(savedDraft?.includePhotos));
    setPhotos([]);
    setMaintenanceChoice(
      savedDraft?.maintenanceReported ? "issue" : "none"
    );
    setMaintenanceTitle(savedDraft?.maintenanceTitle ?? "");
    setMaintenanceDescription(
      savedDraft?.maintenanceDescription ?? ""
    );
    setMaintenanceUrgency(
      savedDraft?.maintenanceUrgency ?? "Medium"
    );
    setMaintenancePhotos([]);
    setCleaningFee(
      String(
        savedDraft?.cleaningFee ??
          task?.cleaningFee ??
          task?.amount ??
          task?.invoiceAmount ??
          task?.price ??
          ""
      )
    );
    setError("");
  }, [task]);

  const buildResult = (): CompleteTaskResult => ({
    guestReady: guestReady === "yes",
    notes: notes.trim(),
    includePhotos,
    photos,
    maintenanceReported: maintenanceChoice === "issue",
    maintenanceTitle: maintenanceTitle.trim(),
    maintenanceDescription: maintenanceDescription.trim(),
    maintenanceUrgency,
    maintenancePhotos,
    cleaningFee: cleaningFee.trim(),
  });

  const handleSaveDraft = () => {
    setError("");
    onSaveDraft(buildResult());
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (guestReady === "no" && maintenanceChoice !== "issue") {
      setError(
        "Please report the issue preventing the property from being guest ready."
      );
      return;
    }

    if (
      maintenanceChoice === "issue" &&
      (!maintenanceTitle.trim() ||
        !maintenanceDescription.trim())
    ) {
      setError(
        "Add a maintenance title and description before finishing."
      );
      return;
    }

    onFinish(buildResult());
  };

  return (
    <div className="modalOverlay completeTaskOverlay" onClick={onClose}>
      <div
        className="modalCard completeTaskModal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="completeTaskHeader">
          <div>
            <p className="eyebrow">Complete Task</p>
            <h3>🎉 Great job!</h3>
            <p>
              {home?.name ?? "Property"} is almost ready to report.
            </p>
          </div>

          <button
            type="button"
            className="cleanerScheduleClose"
            onClick={onClose}
            aria-label="Close complete task"
          >
            ✕
          </button>
        </div>

        <form className="completeTaskForm" onSubmit={handleSubmit}>
          <fieldset className="completeTaskSection">
            <legend>Is the property guest ready?</legend>

            <div className="completeTaskChoiceGrid">
              <label
                className={
                  guestReady === "yes"
                    ? "completeTaskChoice selected"
                    : "completeTaskChoice"
                }
              >
                <input
                  type="radio"
                  name="guest-ready"
                  value="yes"
                  checked={guestReady === "yes"}
                  onChange={() => setGuestReady("yes")}
                />
                <span>✅ Yes</span>
              </label>

              <label
                className={
                  guestReady === "no"
                    ? "completeTaskChoice selected"
                    : "completeTaskChoice"
                }
              >
                <input
                  type="radio"
                  name="guest-ready"
                  value="no"
                  checked={guestReady === "no"}
                  onChange={() => {
                    setGuestReady("no");
                  }}
                />
                <span>⚠️ No</span>
              </label>
            </div>
          </fieldset>

          <label className="completeTaskField">
            Message to Homeowner <small>(optional)</small>

            <span className="completeTaskFieldHelp">
              This message will be included in the owner&apos;s completion report.
            </span>

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything the owner should know about this task?"
            />
          </label>

          <section className="completeTaskSection">
            <label className="completeTaskToggle">
              <input
                type="checkbox"
                checked={includePhotos}
                onChange={(event) => {
                  setIncludePhotos(event.target.checked);

                  if (!event.target.checked) {
                    setPhotos([]);
                  }
                }}
              />

              <span className="completeTaskPhotoCopy">
                <span className="completeTaskPhotoIcon" aria-hidden="true">
                  📷
                </span>

                <span>
                  <strong>Include photos</strong>
                  <small>Optional proof for the owner report</small>
                </span>
              </span>
            </label>

            {includePhotos && (
              <label className="completeTaskUpload">
                Upload photos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) =>
                    setPhotos(
                      event.target.files
                        ? Array.from(event.target.files)
                        : []
                    )
                  }
                />

                {photos.length > 0 && (
                  <small>
                    {photos.length} photo
                    {photos.length === 1 ? "" : "s"} selected
                  </small>
                )}
              </label>
            )}
          </section>

          <fieldset className="completeTaskSection">
            <legend>Did you notice a maintenance issue?</legend>

            <div className="completeTaskChoiceGrid">
              <label
                className={
                  maintenanceChoice === "none"
                    ? "completeTaskChoice selected"
                    : "completeTaskChoice"
                }
              >
                <input
                  type="radio"
                  name="maintenance"
                  value="none"
                  checked={maintenanceChoice === "none"}
                  onChange={() => {
                    setMaintenanceChoice("none");
                    setMaintenancePhotos([]);
                  }}
                />
                <span>No issue</span>
              </label>

              <label
                className={
                  maintenanceChoice === "issue"
                    ? "completeTaskChoice selected"
                    : "completeTaskChoice"
                }
              >
                <input
                  type="radio"
                  name="maintenance"
                  value="issue"
                  checked={maintenanceChoice === "issue"}
                  onChange={() => setMaintenanceChoice("issue")}
                />
                <span>Report maintenance issue</span>
              </label>
            </div>

            {maintenanceChoice === "issue" && (
              <div className="completeTaskMaintenanceFields">
                <label className="completeTaskField">
                  Issue title
                  <input
                    value={maintenanceTitle}
                    onChange={(event) =>
                      setMaintenanceTitle(event.target.value)
                    }
                    placeholder="Example: Dripping bathroom faucet"
                  />
                </label>

                <label className="completeTaskField">
                  Description
                  <textarea
                    value={maintenanceDescription}
                    onChange={(event) =>
                      setMaintenanceDescription(event.target.value)
                    }
                    placeholder="What did you notice and does it affect the next guest?"
                  />
                </label>

                <label className="completeTaskField">
                  Priority
                  <select
                    value={maintenanceUrgency}
                    onChange={(event) =>
                      setMaintenanceUrgency(
                        event.target.value as
                          | "Low"
                          | "Medium"
                          | "High"
                      )
                    }
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </label>

 <label className="completeTaskUpload maintenancePhotoUpload">
  <div className="completeTaskPhotoCopy">
    <div className="completeTaskPhotoIcon">📷</div>

    <div>
      <strong>Maintenance photos</strong>
      <small>Optional photos of the issue</small>
    </div>
  </div>

  <input
    type="file"
    accept="image/*"
    multiple
    onChange={(event) =>
      setMaintenancePhotos(
        event.target.files
          ? Array.from(event.target.files)
          : []
      )
    }
  />

  {maintenancePhotos.length > 0 && (
    <small>
      {maintenancePhotos.length} maintenance photo
      {maintenancePhotos.length === 1 ? "" : "s"} selected
    </small>
  )}
</label>
              </div>
            )}
          </fieldset>

          <label className="completeTaskField">
            Cleaning fee
            <div className="completeTaskMoneyInput">
              <span>$</span>
              <input
                inputMode="decimal"
                value={cleaningFee}
                onChange={(event) =>
                  setCleaningFee(event.target.value)
                }
                placeholder="0.00"
              />
            </div>
          </label>

          {error && (
            <p className="completeTaskError" role="alert">
              {error}
            </p>
          )}

          <div className="completeTaskActions">
            <div className="completeTaskSecondaryActions">
              <button
                type="button"
                className="secondaryButton"
                onClick={onClose}
              >
                Back to Task
              </button>

              <button
                type="button"
                className="completeTaskUndoButton"
                onClick={onUndoStart}
              >
                Undo Start
              </button>
            </div>

            <div className="completeTaskFinalActions">
              <button
                type="button"
                className="completeTaskDraftButton"
                onClick={handleSaveDraft}
              >
                Save &amp; Finish Later
              </button>

              <button
                type="submit"
                className="completeTaskFinishButton"
              >
                Finish &amp; Notify Owner
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}