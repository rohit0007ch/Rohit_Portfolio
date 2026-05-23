import "./styles/Skills.css";
import { FaSwift, FaWrench } from "react-icons/fa6";
import { TbBrandFlutter } from "react-icons/tb";
import { IoLogoFirebase } from "react-icons/io5";

const Skills = () => {
  const skillGroups = [
    {
      title: "iOS Native",
      icon: <FaSwift />,
      desc: "Architecting high-fidelity, high-performance native Apple applications with Swift and robust custom layouts.",
      tags: [
        "Swift",
        "UIKit",
        "Xcode",
        "CoreBluetooth",
        "MVVM",
        "App Store Connect",
        "Permissions",
      ],
    },
    {
      title: "Cross-Platform",
      icon: <TbBrandFlutter />,
      desc: "Building gorgeous, highly-performant cross-platform mobile apps for iOS and Android with modular widgets.",
      tags: [
        "Flutter",
        "Dart",
        "GetX",
        "Provider",
        "REST APIs",
        "WebViews",
        "Hardware Sync",
      ],
    },
    {
      title: "Backend & Cloud",
      icon: <IoLogoFirebase />,
      desc: "Integrating state-of-the-art serverless services and cloud databases for mobile application backends.",
      tags: [
        "Firebase Auth",
        "Firestore",
        "Remote Config",
        "Crashlytics",
        "Push Notifications",
        "Cloud Analytics",
      ],
    },
    {
      title: "Tools",
      icon: <FaWrench />,
      desc: "IDEs, design, API testing, version control, and AI-assisted development tools I use day to day.",
      tags: [
        "Xcode",
        "Android Studio",
        "VS Code",
        "Git",
        "GitHub Desktop",
        "Postman",
        "Firebase Console",
        "Figma",
        "Cursor AI",
        "Claude",
      ],
    },
  ];

  return (
    <div className="skills-section section-container" id="skills">
      <h2>
        Skills <span>&</span> Tools
      </h2>
      <div className="skills-subtitle">iOS · Flutter · Mobile Development</div>
      <div className="skills-grid">
        {skillGroups.map((group, index) => (
          <div className="skills-card" key={index}>
            <div className="skills-card-inner">
              <div className="skills-card-header">
                <div className="skills-card-icon">{group.icon}</div>
                <h3>{group.title}</h3>
              </div>
              <p>{group.desc}</p>
              <div className="skills-tags-container">
                {group.tags.map((tag, tIndex) => (
                  <span className="skills-tag" key={tIndex}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Skills;
