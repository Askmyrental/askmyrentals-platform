type MissionControlHeaderProps = {
  propertyName: string;
  bannerImage?: string;
  weather: string;
  notifications: number;
  arrivalsToday: number;
  cleansToday: number;
  onNotificationClick?: () => void;
};

export default function MissionControlHeader({
  propertyName,
  bannerImage,
  weather,
  notifications,
  arrivalsToday,
  cleansToday,
  onNotificationClick,
}: MissionControlHeaderProps) {
  return (
    <header className="missionControlHeader">
      <div
        className="missionControlBanner"
        style={bannerImage ? { backgroundImage: `url(${bannerImage})` } : undefined}
      >
        <div className="missionControlOverlay">
          <div className="missionTopRow">
  <h1>{propertyName}</h1>

  <div className="missionHeaderRight">
    <span>☀️ {weather}</span>

    <button
      className="notificationButton"
      type="button"
      onClick={onNotificationClick}
      aria-label="Open Notification Center"
    >
      🔔
      {notifications > 0 && (
        <span className="notificationBadge">
          {notifications}
        </span>
      )}
    </button>
  </div>
</div>
      

          <div className="missionStats">
            <div>
              <strong>{cleansToday}</strong>
              <span>Cleans Today</span>
            </div>

            <div>
              <strong>{arrivalsToday}</strong>
              <span>Arrivals</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}