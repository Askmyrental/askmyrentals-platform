export const getUrgencyForCleaning = (item: any) => {
  const today = new Date();
  const departureDate = new Date(item.departure);

  const diffMs = departureDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (
    item.status !== "Ready" &&
    diffDays <= 1
  ) {
    return {
      label: "Urgent",
      className: "status red",
      reason: "Turnover is due within 24 hours and is not ready.",
    };
  }

  if (
    item.status === "Assigned" ||
    item.status === "Accepted"
  ) {
    return {
      label: "Attention",
      className: "status orange",
      reason: "Cleaner assigned but progress has not started.",
    };
  }

  return {
    label: "Normal",
    className: "status green",
    reason: "Turnover is currently on track.",
  };
};