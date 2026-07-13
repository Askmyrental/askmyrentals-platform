import type { ReactNode } from "react";
import "./landing-page.css";

type LandingPageProps = {
  cleanerLoginPath?: string;
  ownerLoginPath?: string;
  cleanerSignupPath?: string;
};

type FeatureCardProps = {
  icon: ReactNode;
  title: string;
  copy: string;
};

function FeatureCard({ icon, title, copy }: FeatureCardProps) {
  return (
    <article className="amrMarketingFeatureCard">
      <div className="amrMarketingFeatureIcon">{icon}</div>
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  );
}

export default function LandingPage({
  cleanerLoginPath = "/cleaner/login",
  ownerLoginPath = "/owner/login",
  cleanerSignupPath = "/cleaner/signup",
}: LandingPageProps) {
  const goTo = (path: string) => {
    window.location.href = path;
  };

  return (
    <div className="amrMarketingPage">
      <header className="amrMarketingHero">
        <nav className="amrMarketingNav" aria-label="Main navigation">
          <button
            type="button"
            className="amrMarketingBrand"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="AMR home"
          >
            <span className="amrMarketingBrandMark">⌂</span>
            <span>
              <strong>AMR</strong>
              <small>Ask My Rentals</small>
            </span>
          </button>

          <div className="amrMarketingNavLinks">
            <a href="#product">Product</a>
            <a href="#cleaners">For Cleaners</a>
            <a href="#owners">For Owners</a>
            <a href="#pricing">Pricing</a>
          </div>

          <div className="amrMarketingNavActions">
            <button
              type="button"
              className="amrMarketingTextButton"
              onClick={() => goTo(cleanerLoginPath)}
            >
              Cleaner Login
            </button>

            <button
              type="button"
              className="amrMarketingOwnerButton"
              onClick={() => goTo(ownerLoginPath)}
            >
              Owner Login
            </button>
          </div>
        </nav>

        <section className="amrMarketingHeroGrid">
          <div className="amrMarketingHeroCopy">
            <span className="amrMarketingEyebrow">Built for cleaners</span>

            <h1>
              Run your cleaning business with{" "}
              <span>more clarity.</span>
            </h1>

            <p>
              AMR brings schedules, properties, jobs, invoices, and payments
              together in one simple place.
            </p>

            <div className="amrMarketingHeroActions">
              <button
                type="button"
                className="amrMarketingPrimaryButton"
                onClick={() => goTo(cleanerSignupPath)}
              >
                Start Free Trial <span aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                className="amrMarketingSecondaryButton"
                onClick={() =>
                  document
                    .getElementById("product")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                See the Platform <span aria-hidden="true">▶</span>
              </button>
            </div>

            <div className="amrMarketingTrustRow">
              <span>✓ Built for cleaners</span>
              <span>✓ Get paid faster</span>
              <span>✓ Simple and organized</span>
            </div>
          </div>

          <div className="amrMarketingProductFrame" aria-label="AMR product preview">
            <div className="amrMarketingBrowserBar">
              <span />
              <span />
              <span />
            </div>

            <div className="amrMarketingProductShell">
              <aside className="amrMarketingProductSidebar">
                <div className="amrMarketingMiniBrand">
                  <span>⌂</span>
                  <strong>AMR</strong>
                </div>

                {["Pulse", "Schedule", "Properties", "Jobs", "Invoices", "Reports"].map(
                  (item, index) => (
                    <div
                      key={item}
                      className={
                        index === 0
                          ? "amrMarketingMiniNavItem active"
                          : "amrMarketingMiniNavItem"
                      }
                    >
                      <span>{["✦", "□", "⌂", "✓", "$", "▥"][index]}</span>
                      {item}
                    </div>
                  )
                )}
              </aside>

              <div className="amrMarketingProductMain">
                <div className="amrMarketingProductHeader">
                  <div>
                    <h2>Welcome back, Taylor 👋</h2>
                    <p>Your workday is organized and ready.</p>
                  </div>

                  <button type="button">+ New Invoice</button>
                </div>

                <div className="amrMarketingMetricRow">
                  <article>
                    <span>Today</span>
                    <strong>3</strong>
                    <small>Jobs scheduled</small>
                  </article>

                  <article>
                    <span>In Progress</span>
                    <strong>2</strong>
                    <small>Active jobs</small>
                  </article>

                  <article>
                    <span>Ready to Invoice</span>
                    <strong>2</strong>
                    <small>Completed tasks</small>
                  </article>
                </div>

                <div className="amrMarketingDashboardGrid">
                  <section className="amrMarketingSchedulePanel">
                    <div className="amrMarketingPanelHeader">
                      <strong>Today&apos;s Schedule</strong>
                      <span>View calendar</span>
                    </div>

                    {[
                      ["10:00 AM", "Sea Otz", "In Progress"],
                      ["11:30 AM", "Ocean View", "Upcoming"],
                      ["1:00 PM", "Sunset Retreat", "Upcoming"],
                    ].map(([time, property, status]) => (
                      <div className="amrMarketingScheduleRow" key={`${time}-${property}`}>
                        <div>
                          <small>{time}</small>
                          <strong>{property}</strong>
                        </div>
                        <span
                          className={
                            status === "In Progress"
                              ? "amrMarketingStatus active"
                              : "amrMarketingStatus"
                          }
                        >
                          {status}
                        </span>
                      </div>
                    ))}
                  </section>

                  <section className="amrMarketingHealthPanel">
                    <strong>Business Health</strong>
                    <div className="amrMarketingHealthRing">
                      <span>92%</span>
                      <small>Excellent</small>
                    </div>
                    <ul>
                      <li>Schedule is on track</li>
                      <li>Payments connected</li>
                      <li>Tasks up to date</li>
                      <li>Invoices on track</li>
                    </ul>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </section>
      </header>

      <main>
        <section className="amrMarketingFeatureSection" id="product">
          <div className="amrMarketingSectionHeading">
            <span className="amrMarketingEyebrow">One simple platform</span>
            <h2>Everything behind every clean, in one place.</h2>
          </div>

          <div className="amrMarketingFeatureGrid">
            <FeatureCard
              icon="□"
              title="Schedule"
              copy="Plan cleans, organize jobs, and keep every day on track."
            />
            <FeatureCard
              icon="⌂"
              title="Properties"
              copy="Keep property details, notes, and preferences organized."
            />
            <FeatureCard
              icon="✓"
              title="Jobs & Tasks"
              copy="Start work, complete tasks, and stay on top of every clean."
            />
            <FeatureCard
              icon="$"
              title="Invoices & Payments"
              copy="Create invoices in seconds and get paid through Stripe."
            />
          </div>
        </section>

        <section className="amrMarketingSplitSection" id="cleaners">
          <div className="amrMarketingSplitCopy">
            <span className="amrMarketingEyebrow">Cleaner first</span>
            <h2>Built for cleaners. Easy for owners.</h2>
            <p>
              Cleaners run the operation. Owners stay informed and pay invoices
              with ease. Everyone gets what they need without the clutter.
            </p>

            <div className="amrMarketingBulletList">
              <span>✓ Cleaners stay organized and efficient</span>
              <span>✓ Owners get visibility without taking over</span>
              <span>✓ Payments and records stay connected</span>
            </div>
          </div>

          <div className="amrMarketingInvoicePreview" id="owners">
            <div className="amrMarketingInvoiceList">
              <div className="amrMarketingPanelHeader">
                <strong>Recent Invoices</strong>
                <span>View all</span>
              </div>

              {[
                ["Sea Otz", "$320.00", "Paid"],
                ["Ocean View", "$280.00", "Sent"],
                ["Sunset Retreat", "$450.00", "Sent"],
              ].map(([name, amount, status]) => (
                <div className="amrMarketingInvoiceRow" key={name}>
                  <strong>{name}</strong>
                  <span>{amount}</span>
                  <small className={status === "Paid" ? "paid" : ""}>
                    {status}
                  </small>
                </div>
              ))}
            </div>

            <div className="amrMarketingPayCard">
              <span>Invoice #1043</span>
              <strong>$320.00</strong>
              <small>Due Jun 2, 2026</small>
              <button type="button">Pay Invoice</button>
              <em>Secured by Stripe</em>
            </div>
          </div>
        </section>

        <section className="amrMarketingCta" id="pricing">
          <div>
            <span className="amrMarketingCtaIcon">✦</span>
          </div>

          <div>
            <h2>Ready to simplify the business side of cleaning?</h2>
            <p>Start with AMR and keep your day moving.</p>
          </div>

          <button
            type="button"
            className="amrMarketingPrimaryButton"
            onClick={() => goTo(cleanerSignupPath)}
          >
            Get Started <span aria-hidden="true">→</span>
          </button>
        </section>
      </main>

      <footer className="amrMarketingFooter">
        <div>
          <div className="amrMarketingFooterBrand">
            <span className="amrMarketingBrandMark">⌂</span>
            <div>
              <strong>AMR</strong>
              <small>Ask My Rentals</small>
            </div>
          </div>
          <p>Software built for cleaning businesses that want more clarity.</p>
        </div>

        <div>
          <strong>Product</strong>
          <a href="#product">Features</a>
          <a href="#cleaners">For Cleaners</a>
          <a href="#owners">For Owners</a>
        </div>

        <div>
          <strong>Company</strong>
          <a href="#about">About</a>
          <a href="#pricing">Pricing</a>
          <a href="mailto:hello@askmyrentals.com">Contact</a>
        </div>

        <div>
          <strong>Access</strong>
          <button type="button" onClick={() => goTo(cleanerLoginPath)}>
            Cleaner Login
          </button>
          <button type="button" onClick={() => goTo(ownerLoginPath)}>
            Owner Login
          </button>
        </div>
      </footer>
    </div>
  );
}
