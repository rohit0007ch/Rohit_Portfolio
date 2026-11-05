import { useEffect, useState } from "react";
import ScrollTrigger from "gsap/ScrollTrigger";
import HoverLinks from "./HoverLinks";
import gsap from "gsap";
import ScrollSmoother from "gsap/ScrollSmoother";
import { IoEyeOutline } from "react-icons/io5";
import { fetchLiveTelemetry } from "../lib/analytics/fetchLiveTelemetry";
import "./styles/Navbar.css";

gsap.registerPlugin(ScrollSmoother, ScrollTrigger);
export let smoother: ScrollSmoother;

/** Keep under the 60s active-session window so the eye count stays live. */
const EYE_COUNT_REFRESH_MS = 5_000;

interface NavbarProps {
  onLiveClick?: () => void;
}

const Navbar = ({ onLiveClick }: NavbarProps) => {
  const [liveCount, setLiveCount] = useState<number | null>(null);

  useEffect(() => {
    smoother = ScrollSmoother.create({
      wrapper: "#smooth-wrapper",
      content: "#smooth-content",
      smooth: 1.7,
      speed: 1.7,
      effects: true,
      autoResize: true,
      ignoreMobileResize: true,
    });

    smoother.scrollTop(0);
    smoother.paused(true);

    let links = document.querySelectorAll(".header ul a[data-href]");
    links.forEach((elem) => {
      let element = elem as HTMLAnchorElement;
      element.addEventListener("click", (e) => {
        const section = element.getAttribute("data-href");
        if (window.innerWidth > 1024 && section) {
          e.preventDefault();
          smoother.scrollTo(section, true, "top top");
        }
      });
    });
    window.addEventListener("resize", () => {
      ScrollSmoother.refresh(true);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let inFlight: AbortController | null = null;
    let timer: number | null = null;

    const loadCount = async () => {
      if (inFlight || document.visibilityState === "hidden") return;
      const controller = new AbortController();
      inFlight = controller;
      try {
        const payload = await fetchLiveTelemetry(controller.signal);
        if (!cancelled) {
          // Eye badge = currently live watchers (60s last_seen window), not totals.
          setLiveCount(payload.overview.activeWatchers);
        }
      } catch {
        // Keep last known count; eye button still opens the modal.
      } finally {
        if (inFlight === controller) inFlight = null;
      }
    };

    const start = () => {
      if (timer != null) window.clearInterval(timer);
      timer = window.setInterval(() => {
        void loadCount();
      }, EYE_COUNT_REFRESH_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (timer != null) {
          window.clearInterval(timer);
          timer = null;
        }
        inFlight?.abort();
        inFlight = null;
        return;
      }
      void loadCount();
      start();
    };

    void loadCount();
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer != null) window.clearInterval(timer);
      inFlight?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <>
      <div className="header">
        <a href="/#" className="navbar-title" data-cursor="disable">
          ROHIT
        </a>
        <a
          href="mailto:rc11102003@gmail.com"
          className="navbar-connect"
          data-cursor="disable"
        >
          rc11102003@gmail.com
        </a>
        <ul>
          <li>
            <a data-href="#about" href="#about">
              <HoverLinks text="ABOUT" />
            </a>
          </li>
          <li>
            <a data-href="#skills" href="#skills">
              <HoverLinks text="SKILLS" />
            </a>
          </li>
          <li>
            <a data-href="#work" href="#work">
              <HoverLinks text="WORK" />
            </a>
          </li>
          <li>
            <a data-href="#contact" href="#contact">
              <HoverLinks text="CONTACT" />
            </a>
          </li>
          <li>
            <button
              type="button"
              className={`navbar-eye-btn${
                liveCount != null && liveCount > 0 ? " is-live" : ""
              }`}
              data-cursor="disable"
              onClick={onLiveClick}
              aria-label={`Open live visitor telemetry${
                liveCount != null ? `, ${liveCount} watching now` : ""
              }`}
              title={
                liveCount != null
                  ? `${liveCount} live now`
                  : "Live visitor telemetry"
              }
            >
              <span className="navbar-eye-live-dot" aria-hidden="true" />
              <IoEyeOutline className="navbar-eye-icon" aria-hidden="true" />
              <span className="navbar-eye-count">
                {liveCount == null ? "—" : liveCount.toLocaleString("en-IN")}
              </span>
            </button>
          </li>
        </ul>
      </div>

      <div className="landing-circle1"></div>
      <div className="landing-circle2"></div>
      <div className="nav-fade"></div>
    </>
  );
};

export default Navbar;
