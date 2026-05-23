import { useEffect, useState } from "react";
import "./styles/Loading.css";
import { useLoading } from "../context/LoadingProvider";
import Marquee from "react-fast-marquee";
import { FaSwift } from "react-icons/fa6";
import { TbBrandFlutter } from "react-icons/tb";
import { SiFirebase, SiXcode, SiDart } from "react-icons/si";

const MARQUEE_ITEMS = [
  "Swift",
  "Flutter",
  "UIKit",
  "Dart",
  "Xcode",
  "Firebase",
  "MVVM",
  "GetX",
  "Core Data",
  "App Store",
];

const TECH_PILLS = [
  { icon: <FaSwift />, label: "Swift" },
  { icon: <TbBrandFlutter />, label: "Flutter" },
  { icon: <SiXcode />, label: "Xcode" },
  { icon: <SiDart />, label: "Dart" },
  { icon: <SiFirebase />, label: "Firebase" },
];

const CODE_LINES = [
  { tone: "comment", text: "// Initializing mobile stack…" },
  { tone: "keyword", text: "import SwiftUI" },
  { tone: "keyword", text: "import Flutter" },
  { tone: "plain", text: "let role: Role = .iOSFlutterDev" },
  { tone: "plain", text: "await portfolio.launch()" },
];

const STATUS_MESSAGES = [
  "Compiling assets",
  "Linking frameworks",
  "Configuring Firebase",
  "Preparing UI layers",
  "Almost ready",
];

const Loading = ({ percent }: { percent: number }) => {
  const { setIsLoading } = useLoading();
  const [loaded, setLoaded] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [clicked, setClicked] = useState(false);
  const [codeLine, setCodeLine] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);

  useEffect(() => {
    if (percent < 100) return;
    const t1 = setTimeout(() => setLoaded(true), 600);
    const t2 = setTimeout(() => setIsLoaded(true), 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [percent]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCodeLine((prev) => (prev + 1) % CODE_LINES.length);
    }, 1600);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIdx((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    import("./utils/initialFX").then((module) => {
      if (isLoaded) {
        setClicked(true);
        setTimeout(() => {
          module.initialFX?.();
          setIsLoading(false);
        }, 900);
      }
    });
  }, [isLoaded, setIsLoading]);

  function handleMouseMove(e: React.MouseEvent<HTMLElement>) {
    const { currentTarget: target } = e;
    const rect = target.getBoundingClientRect();
    target.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    target.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  }

  const ringRadius = 110;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (percent / 100) * ringCircumference;

  return (
    <>
      <div className="loading-header">
        <a href="/#" className="loader-title" data-cursor="disable">
          ROHIT
        </a>
        <span className="loader-badge">iOS · Flutter</span>
      </div>

      <div className="loading-screen">
        <div className="loading-bg" aria-hidden="true">
          <div className="loading-bg-grid" />
          <div className="loading-glow loading-glow--1" />
          <div className="loading-glow loading-glow--2" />
          <div className="loading-glow loading-glow--3" />
        </div>

        <div className="loading-marquee" aria-hidden="true">
          <Marquee speed={40} gradient={false}>
            {MARQUEE_ITEMS.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </Marquee>
        </div>

        <div className="loading-stage">
          <p className="loading-eyebrow">Mobile Application Developer</p>

          <div className="loading-terminal">
            <div className="loading-terminal-bar">
              <div className="loading-code-dots">
                <span />
                <span />
                <span />
              </div>
              <span className="loading-terminal-title">Portfolio.xcodeproj</span>
            </div>
            <div className="loading-code-body">
              {CODE_LINES.map((line, index) => (
                <p
                  key={line.text}
                  className={`loading-code-line loading-code-line--${line.tone}${
                    index === codeLine ? " is-active" : ""
                  }`}
                >
                  {line.text}
                </p>
              ))}
            </div>
          </div>

          <div className="loading-cta-block">
            <div className="loading-ring" aria-hidden="true">
              <svg viewBox="0 0 240 240">
                <defs>
                  <linearGradient
                    id="loadingRingGrad"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#c481ff" />
                  </linearGradient>
                </defs>
                <circle
                  className="loading-ring-track"
                  cx="120"
                  cy="120"
                  r={ringRadius}
                />
                <circle
                  className="loading-ring-progress"
                  cx="120"
                  cy="120"
                  r={ringRadius}
                  style={{
                    strokeDasharray: ringCircumference,
                    strokeDashoffset: ringOffset,
                  }}
                />
              </svg>
            </div>

            <div
              className={`loading-wrap ${clicked ? "loading-clicked" : ""}`}
              onMouseMove={handleMouseMove}
            >
              <div className="loading-hover" />
              <div
                className={`loading-button ${loaded ? "loading-complete" : ""}`}
              >
                <div className="loading-container">
                  <div className="loading-content">
                    <div className="loading-content-in">
                      {loaded ? (
                        <>Enter<span className="loading-pct"> →</span></>
                      ) : (
                        <>
                          Loading <span className="loading-pct">{percent}%</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="loading-box" />
                </div>
                <div className="loading-content2">
                  <span>Welcome</span>
                </div>
              </div>
            </div>
          </div>

          <div className="loading-bar">
            <div
              className="loading-bar-fill"
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <p className="loading-status">
            {loaded ? "Ready to explore" : STATUS_MESSAGES[statusIdx]}
          </p>

          <div className="loading-tech-strip">
            {TECH_PILLS.map((pill) => (
              <span className="loading-tech-pill" key={pill.label}>
                {pill.icon}
                <span>{pill.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Loading;

export const setProgress = (setLoading: (value: number) => void) => {
  let percent: number = 0;

  let interval = setInterval(() => {
    if (percent <= 50) {
      const rand = Math.round(Math.random() * 5);
      percent = percent + rand;
      setLoading(percent);
    } else {
      clearInterval(interval);
      interval = setInterval(() => {
        percent = percent + Math.round(Math.random());
        setLoading(percent);
        if (percent > 91) {
          clearInterval(interval);
        }
      }, 2000);
    }
  }, 100);

  function clear() {
    clearInterval(interval);
    setLoading(100);
  }

  function loaded() {
    return new Promise<number>((resolve) => {
      clearInterval(interval);
      interval = setInterval(() => {
        if (percent < 100) {
          percent++;
          setLoading(percent);
        } else {
          resolve(percent);
          clearInterval(interval);
        }
      }, 2);
    });
  }
  return { loaded, percent, clear };
};
