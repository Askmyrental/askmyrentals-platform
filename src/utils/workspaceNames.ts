export async function loadWorkspaceNames(client: any): Promise<Record<string, string>> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("Please log in to load workspace names.");
  const apiUrl = String(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
  const response = await fetch(`${apiUrl}/api/workspace-names`, {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  });
  if (!response.ok) throw new Error("Unable to load workspace names. Please try again.");
  return (await response.json()).names;
}
