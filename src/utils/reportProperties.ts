// Use only records already loaded through the caller's existing access checks.
export function buildReportProperties(homes: any[], items: any[]) {
  const properties = new Map<string, any>();
  for (const home of homes) properties.set(String(home.id), { ...home });
  for (const item of items) {
    const id = String(item.property_id ?? item.propertyId ?? item.home_id ?? item.homeId ?? "");
    if (!id) continue;
    const current = properties.get(id);
    const firstText = (...values: unknown[]) => values.find(
      (value) => typeof value === "string" && value.trim(),
    ) as string | undefined;
    const address = firstText(current?.address, item.propertyAddress, item.property_address,
      item.service_address, item.serviceAddress, item.property?.address);
    const name = firstText(current?.name, item.propertyName, item.property_name,
      item.property?.property_name);
    properties.set(id, { ...current, id, name: name?.trim() || "", address });
  }
  return [...properties.values()].map((property) => ({
    ...property,
    name: property.name?.trim() || property.address?.trim() || "Unnamed property",
  }));
}
