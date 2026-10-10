// Customer billing amounts only. These values do not represent employee pay.
function chargeNumber(value: unknown): number | null {
  if (value == null || (typeof value === "string" && !value.trim())) return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function resolveCustomerCharge(task: any, home?: any): number | null {
  // A structured override is authoritative, including null (use property default).
  if (Object.prototype.hasOwnProperty.call(task ?? {}, "customerCleaningCharge") ||
      Object.prototype.hasOwnProperty.call(task ?? {}, "customer_cleaning_charge")) {
    const override = chargeNumber(Object.prototype.hasOwnProperty.call(task, "customerCleaningCharge")
      ? task.customerCleaningCharge : task.customer_cleaning_charge);
    if (override !== null) return override;
  } else {
    for (const value of [task?.cleaningFee, task?.amount, task?.invoiceAmount, task?.price]) {
      const amount = chargeNumber(value);
      if (amount !== null) return amount;
    }
  }
  return chargeNumber(task?.propertyCleaningFee) ?? chargeNumber(task?.property?.standard_cleaning_charge)
    ?? chargeNumber(task?.property?.cleaning_fee) ?? chargeNumber(home?.cleaningFee);
}

export function parseCustomerCharge(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text) || Number(text) > 9999999999.99) {
    throw new Error("Enter a non-negative customer cleaning charge with up to two decimal places, or leave it blank to use the property fee.");
  }
  return Number(text);
}

export async function saveCustomerChargeUpdate(
  client: any, table: "reservations" | "cleaner_jobs", id: string,
  previous: number | null, charge: number | null, updates: Record<string, unknown>,
  previousTimeline?: unknown,
) {
  if (charge !== null && (!Number.isFinite(charge) || charge < 0)) throw new Error("Invalid customer cleaning charge.");
  if (table === "cleaner_jobs" && charge === null) throw new Error("Enter a customer charge for this job, including 0 for no charge.");
  if (table === "cleaner_jobs" && charge! > 21474836.47) throw new Error("The job customer charge is too large.");
  const column = table === "reservations" ? "customer_cleaning_charge" : "amount_cents";
  const value = table === "reservations" ? charge : Math.round(charge! * 100);
  const expected = table === "reservations" ? previous : Math.round(previous! * 100);
  let query = client.from(table).update({ ...updates, [column]: value }).eq("id", id);
  query = expected === null ? query.is(column, null) : query.eq(column, expected);
  if (table === "reservations") query = previousTimeline == null
    ? query.is("timeline", null) : query.eq("timeline", JSON.stringify(previousTimeline));
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("The customer charge changed or you no longer have access. Refresh the task and retry. Nothing was saved.");
  return data;
}
