type Reservation = {
  arrival: string;
  departure: string;
};

type WeatherForecastCardProps = {
  reservation: Reservation;
  formatDate: (date: string) => string;
};

const forecastPattern = [
  { icon: "☀️", label: "Sunny", high: 86, rain: 10 },
  { icon: "🌤️", label: "Partly sunny", high: 88, rain: 15 },
  { icon: "🌦️", label: "Scattered showers", high: 84, rain: 45 },
  { icon: "🌧️", label: "Rain possible", high: 79, rain: 70 },
  { icon: "☀️", label: "Sunny", high: 83, rain: 10 },
  { icon: "🌤️", label: "Warm", high: 87, rain: 20 },
  { icon: "⛅", label: "Mixed clouds", high: 85, rain: 25 },
];

function toDate(dateString: string) {
  return new Date(`${dateString}T12:00:00`);
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getStayDates(arrival: string, departure: string) {
  const dates: string[] = [];
  const current = toDate(arrival);
  const checkout = toDate(departure || arrival);

  while (current < checkout && dates.length < 7) {
    dates.push(toInputDate(current));
    current.setDate(current.getDate() + 1);
  }

  if (dates.length === 0 && arrival) dates.push(arrival);

  return dates;
}

export default function WeatherForecastCard({
  reservation,
  formatDate,
}: WeatherForecastCardProps) {
  const stayDates = getStayDates(reservation.arrival, reservation.departure);
  const rainyDay = forecastPattern.find((day) => day.rain >= 60);

  return (
    <article className="reservationWorkspaceCard operationsWeatherCard">
      <div className="operationsCardHeader">
        <div>
          <p className="eyebrow">Stay Forecast</p>
          <h3>Guest Weather Outlook</h3>
        </div>
        <span className="operationsMiniPill">Placeholder</span>
      </div>

      <p className="mutedText">
        Showing a sample 7-day stay forecast. Later this will connect to live weather by property location.
      </p>

      <div className="stayForecastGrid">
        {stayDates.map((date, index) => {
          const forecast = forecastPattern[index % forecastPattern.length];
          const dayLabel = toDate(date).toLocaleDateString(undefined, {
            weekday: "short",
          });

          return (
            <div className="forecastDayCard" key={date}>
              <span>{dayLabel}</span>
              <strong>{forecast.icon}</strong>
              <b>{forecast.high}°</b>
              <small>{forecast.label}</small>
              <em>{forecast.rain}% rain</em>
            </div>
          );
        })}
      </div>

      <div className="operationsInsightBox">
        <strong>{rainyDay ? "Weather note" : "Weather clear"}</strong>
        <p>
          {rainyDay
            ? `Rain risk appears during this stay. Add exterior furniture, entry mats, and guest arrival messaging to the check-in checklist.`
            : `No major weather concerns shown in the sample forecast for ${formatDate(reservation.arrival)}.`}
        </p>
      </div>
    </article>
  );
}
