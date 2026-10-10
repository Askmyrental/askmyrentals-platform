// Keep RLS in charge of access and reject edits based on an outdated note value.
export async function saveTaskNotes(
  client: any,
  table: "reservations" | "cleaner_jobs",
  id: string,
  previousNotes: string | null,
  notes: string,
) {
  let query = client.from(table).update({ notes }).eq("id", id);
  query = previousNotes === null
    ? query.is("notes", null)
    : query.eq("notes", previousNotes);
  const { data, error } = await query.select("id, notes").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("These notes changed or you no longer have access. Reopen the task after refreshing and try again. Your draft has not been saved.");
  }
  return data.notes ?? "";
}
