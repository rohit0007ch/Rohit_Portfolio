import { SplitText } from "gsap-trial/SplitText";
import gsap from "gsap";
import { smoother } from "../Navbar";

function startRoleCarousels() {
  document.querySelectorAll("[data-role-carousel]").forEach((viewport) => {
    const items = Array.from(
      viewport.querySelectorAll<HTMLElement>(".landing-role-item")
    );
    if (items.length < 2) return;

    let current = items.findIndex((el) => el.classList.contains("is-active"));
    if (current < 0) {
      current = 0;
      items[0].classList.add("is-active");
    }

    const swap = () => {
      const prev = items[current];
      current = (current + 1) % items.length;
      const next = items[current];

      gsap.killTweensOf(items);
      gsap.to(prev, {
        opacity: 0,
        y: -12,
        duration: 0.4,
        ease: "power2.in",
        onComplete: () => prev.classList.remove("is-active"),
      });

      next.classList.add("is-active");
      gsap.fromTo(
        next,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", delay: 0.08 }
      );
    };

    gsap.timeline({ repeat: -1, repeatDelay: 3.2, delay: 2.5 }).call(swap);
  });
}

export function initialFX() {
  document.body.style.overflowY = "auto";
  smoother.paused(false);
  document.getElementsByTagName("main")[0].classList.add("main-active");
  gsap.to("body", {
    backgroundColor: "#0b080c",
    duration: 0.5,
    delay: 1,
  });

  const landingText = new SplitText(
    [".landing-role-eyebrow", ".landing-intro h2", ".landing-intro h1"],
    {
      type: "chars,lines",
      linesClass: "split-line",
    }
  );

  gsap.fromTo(
    landingText.chars,
    { opacity: 0, y: 40, filter: "blur(4px)" },
    {
      opacity: 1,
      duration: 1,
      filter: "blur(0px)",
      ease: "power3.out",
      y: 0,
      stagger: 0.02,
      delay: 0.35,
    }
  );

  document.querySelectorAll(".landing-role-item.is-active").forEach((el) => {
    gsap.set(el, { opacity: 1, y: 0 });
  });

  gsap.fromTo(
    ".landing-role-display",
    { opacity: 0, y: 24 },
    {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: "power2.out",
      delay: 0.65,
      onComplete: startRoleCarousels,
    }
  );

  gsap.fromTo(
    [".header", ".icons-section", ".nav-fade"],
    { opacity: 0 },
    {
      opacity: 1,
      duration: 1.2,
      ease: "power1.inOut",
      delay: 0.15,
    }
  );
}
