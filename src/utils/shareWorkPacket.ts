import {
  buildWorkPacketText,
  type WorkPacketInput,
} from "./printWorkPacket";

export async function shareWorkPacket(
  input: WorkPacketInput
): Promise<void> {
  const text = buildWorkPacketText(input);
  const title = `${input.businessName} Cleaner Schedule`;

  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      window.alert(
        "Schedule copied. Paste it into a text message or email."
      );
      return;
    }

    window.prompt(
      "Copy this schedule and paste it into a text message or email:",
      text
    );
  } catch (error) {
    if ((error as Error)?.name !== "AbortError") {
      window.alert(
        "AMR could not open sharing. Use Print / Save PDF instead."
      );
    }
  }
}