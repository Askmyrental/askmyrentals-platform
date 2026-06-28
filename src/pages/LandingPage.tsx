import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <main className="landingPage">
      <header className="landingHeader">
        <Link to="/" className="landingBrand">
          <span className="brandIcon">AMR</span>
          <span>
            Ask My Rentals
            <small>Owner Operations</small>
          </span>
        </Link>

        <nav className="landingNav">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#resources">Resources</a>
          <Link to="/login">Log In</Link>
          <Link to="/signup" className="primaryButton">
            Start Free
          </Link>
        </nav>
      </header>

      <section className="heartbeatHero">
        <div className="heartbeatCopy">
          <p className="eyebrow">Vacation rental owner operating system</p>

          <h1>
            Every vacation rental has a heartbeat.
            <span> We monitor it.</span>
          </h1>

          <p>
            Ask My Rentals watches your calendars, cleaners, maintenance, and
            alerts — so you can focus on providing unforgettable stays.
          </p>

          <div className="landingActions">
            <Link to="/signup" className="primaryButton largeButton">
              Start Free
            </Link>
            <a href="#features" className="secondaryButton largeButton">
              See Features
            </a>
          </div>

          <div className="heroTrust">
            <span>No credit card required</span>
            <span>Setup in minutes</span>
            <span>Cancel anytime</span>
          </div>
        </div>

        <div className="heroScreenshotFrame">
          <div className="browserChrome">
            <span></span>
            <span></span>
            <span></span>
            <p>app.askmyrentals.com</p>
          </div>

          <div className="marketingDashboard">
            <aside>
              <div className="miniLogo">AMR</div>
              <strong>Ask My Rentals</strong>
              <small>Owner Operations</small>

              <label>Active Property</label>
              <div className="fakeSelect">Sea Oats</div>

              <nav>
                <span className="active">Dashboard</span>
                <span>Reservations</span>
                <span>Calendar</span>
                <span>Property Setup</span>
                <span>Occupancy</span>
                <span>Cleaners</span>
                <span>Maintenance</span>
                <span>Notification Center</span>
              </nav>
            </aside>

            <section>
              <div className="marketingTopRow">
                <article className="wideCard">
                  <p>ASK MY RENTALS</p>
                  <h3>Good evening</h3>
                  <span>1 operation needs attention today.</span>
                </article>

                <article className="healthCard">
                  <p>OPERATIONS HEALTH</p>
                  <strong>92%</strong>
                  <span>Excellent</span>
                </article>
              </div>

              <div className="miniStats">
                <article>
                  <p>Arrivals Today</p>
                  <strong>3</strong>
                  <span>Guests checking in</span>
                </article>
                <article>
                  <p>Departures Today</p>
                  <strong>2</strong>
                  <span>Turnovers to watch</span>
                </article>
                <article>
                  <p>Cleans Today</p>
                  <strong>4</strong>
                  <span>1 need cleaner assigned</span>
                </article>
                <article>
                  <p>Cleaner Alerts</p>
                  <strong className="redText">1</strong>
                  <span>0 awaiting acceptance</span>
                </article>
              </div>

              <div className="marketingCards">
                <article>
                  <b>🧹 Housekeeping</b>
                  <strong>21 Upcoming Cleans</strong>
                  <span>20 accepted · 1 unassigned</span>
                </article>

                <article>
                  <b>🔧 Maintenance</b>
                  <strong>2 Open Issues</strong>
                  <span>1 urgent</span>
                </article>

                <article>
                  <b>🏡 Guest Ready</b>
                  <strong>Sea Oats</strong>
                  <span>Review open alerts</span>
                </article>

                <article>
                  <b>🔔 Notifications</b>
                  <strong>2 Open Alerts</strong>
                  <span>Open Notification Center</span>
                </article>
              </div>

              <div className="reservationPreview">
                <p>NEXT 3</p>
                <h4>Upcoming Reservations</h4>
                <div>
                  <span>Airbnb · Sea Oats · Today → May 24</span>
                  <span>VRBO · Sea Oats · May 24 → May 29</span>
                  <span>VRBO · Coates Cabin · May 28 → Jun 2</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>

      <section className="proofStrip" id="features">
        <article>
          <span>🛡️</span>
          <strong>Protect revenue</strong>
          <p>Catch issues before guests are impacted.</p>
        </article>

        <article>
          <span>📅</span>
          <strong>Stay organized</strong>
          <p>One dashboard for every property and task.</p>
        </article>

        <article>
          <span>👥</span>
          <strong>Work with confidence</strong>
          <p>Cleaners, owners, and systems stay aligned.</p>
        </article>

        <article>
          <span>⚡</span>
          <strong>Act fast</strong>
          <p>Real-time alerts for what needs attention.</p>
        </article>

        <article>
          <span>🔒</span>
          <strong>Sleep better</strong>
          <p>Know your properties are in good hands.</p>
        </article>
      </section>

      <section className="productStory">
        <div className="miniProductFrame">
          <div className="browserChrome">
            <span></span>
            <span></span>
            <span></span>
            <p>Calendar Health</p>
          </div>

          <div className="storyMockup">
            <h3>Calendar Health</h3>
            <p>We scan your calendars for gaps and conflicts.</p>

            <div className="alertRow">
              <strong>⚠️ VRBO reservation is not protected on Airbnb</strong>
              <span>Sea Oats · May 28 → Jun 2 · High Priority</span>
            </div>

            <div className="goodRow">Coates Cabin · Good</div>
            <div className="goodRow">Pelican Cove · Good</div>
          </div>
        </div>

        <div>
          <p className="eyebrow">Calendar intelligence</p>
          <h2>Never miss a calendar sync problem again.</h2>
          <p>
            We continuously check Airbnb and VRBO for gaps, overlaps, and
            missing protection — so you can fix issues before double bookings happen.
          </p>
        </div>
      </section>

      <section className="productStory reverse">
        <div>
          <p className="eyebrow">Cleaner coordination</p>
          <h2>Every turnover. Always accounted for.</h2>
          <p>
            Assign cleanings, track acceptance, and give your cleaners everything
            they need to get the job done right.
          </p>
        </div>

        <div className="miniProductFrame">
          <div className="browserChrome">
            <span></span>
            <span></span>
            <span></span>
            <p>Cleaner Portal</p>
          </div>

          <div className="storyMockup">
            <h3>Upcoming Cleans</h3>

            <div className="cleanRow">
              <span>Sea Oats</span>
              <b>Accepted</b>
            </div>
            <div className="cleanRow">
              <span>Coates Cabin</span>
              <b>Accepted</b>
            </div>
            <div className="cleanRow">
              <span>Sunset Point</span>
              <b className="orangeText">Unassigned</b>
            </div>
          </div>
        </div>
      </section>

      <section className="productStory">
        <div className="miniProductFrame">
          <div className="browserChrome">
            <span></span>
            <span></span>
            <span></span>
            <p>Maintenance</p>
          </div>

          <div className="storyMockup">
            <h3>Maintenance</h3>

            <div className="tableRow">
              <span>Loose shower handle</span>
              <b>Owner Review</b>
            </div>
            <div className="tableRow">
              <span>AC not cooling</span>
              <b>Scheduled</b>
            </div>
            <div className="tableRow">
              <span>Front door lock stiff</span>
              <b>Completed</b>
            </div>
          </div>
        </div>

        <div>
          <p className="eyebrow">Maintenance tracking</p>
          <h2>Every issue tracked from report to completion.</h2>
          <p>
            Cleaner reports become owner-reviewed work orders, so nothing gets
            lost in texts, notes, or memory.
          </p>
        </div>
      </section>

      <section className="finalBlueCta" id="pricing">
        <div>
          <p className="eyebrow">Ready when you are</p>
          <h2>Ready to run your rentals with total confidence?</h2>
          <p>Join independent owners who want cleaner operations and fewer surprises.</p>
        </div>

        <Link to="/signup" className="whiteButton">
          Start Your Free Account →
        </Link>
      </section>
    </main>
  );
}