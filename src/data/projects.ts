export type Project = {
  id: string;
  num: string;
  name: string;
  category: string;
  description: string;
  contributions: string[];
  image?: string;
  alt?: string;
  featured?: boolean;
  storeUrl?: string;
  repoUrl?: string;
};

/** Shipped / professional work — highest visual priority */
export const featuredProjects: Project[] = [
  {
    id: "hp-sprocket",
    num: "01",
    name: "HP Sprocket",
    category: "Cross-Platform App Development",
    description:
      "Built and maintained the HP Sprocket mobile application using Flutter and Native iOS, delivering reliable printer connectivity, authentication, and a polished cross-platform experience.",
    contributions: [
      "Developed cross-platform features with Flutter and Dart for iOS and Android",
      "Integrated Firebase Auth, push notifications, and Crashlytics for stability",
      "Implemented localization, WebViews, and app permission flows",
      "Tuned performance and hardware communication for consistent printing workflows",
    ],
    image: "/images/hp_sprocket.png",
    alt: "HP Sprocket Mobile App Mockup",
    featured: true,
  },
  {
    id: "kodak-step",
    num: "02",
    name: "Kodak Step Print",
    category: "Native iOS App Development",
    description:
      "Worked on the Kodak Step Printer mobile application using Native iOS development, focusing on printer connectivity, firmware management, and advanced app functionalities.",
    contributions: [
      "Implemented firmware update workflows for printer devices to improve performance and stability",
      "Developed advanced popup flows and custom alert logic for seamless user interactions",
      "Managed app permissions including Bluetooth, Camera, Photos, and Notifications",
      "Enhanced printer communication workflows and optimized application stability",
      "Improved UI interactions and overall app experience through efficient logic implementation",
    ],
    image: "/images/kodak_step.png",
    alt: "Kodak Step Print iOS App Mockup",
    featured: true,
    storeUrl: "https://apps.apple.com/in/app/kodak-step-prints/id1494704742",
  },
  {
    id: "lifeprint",
    num: "03",
    name: "LifePrint",
    category: "Native iOS App Development",
    description:
      "Contributed to the development of the LifePrint mobile application using Native iOS development, focusing on UI customization, image processing, and app optimization.",
    contributions: [
      "Implemented photo cropping and image editing functionalities for enhanced user customization",
      "Developed and customized advanced Tab Bar UI for smoother navigation and better user experience",
      "Worked on UI refinements, layout optimizations, and responsive screen adjustments",
      "Performed debugging and issue resolution to improve app stability and performance",
      "Improved application workflows and user interactions through optimized UI implementation",
      "Collaborated on feature enhancements and platform-specific Native iOS functionalities",
    ],
    alt: "LifePrint iOS App",
    featured: true,
    storeUrl: "https://apps.apple.com/in/app/lifeprint-printers/id972104022",
  },
];

/**
 * Extracted from portfolio (Projects.tsx) and linked local Swift repos
 * under ~/Documents/swiftApp/
 */
export const openSourceProjects: Project[] = [
  {
    id: "instagram-clone",
    num: "04",
    name: "InstagramClone",
    category: "Native iOS · UIKit · Core Data",
    description:
      "An Instagram-like social app with user profiles, posts, and photo uploads. Features authentication, a dynamic feed from REST APIs, and offline Core Data caching.",
    contributions: [
      "Built login and registration flows with Core Data user persistence",
      "Fetched and displayed feed data via URLSession from REST APIs",
      "Implemented tab bar, drawer menu, profile, search, and messaging screens",
      "Added UIImagePicker-based media upload and story/post collection views",
      "Designed responsive UIKit layouts with Auto Layout across key flows",
    ],
    image: "/images/instagram_clone.png",
    alt: "InstagramClone feed screen",
    repoUrl: "https://github.com/rohit0007ch/InstagramClone",
  },
  {
    id: "budget-pro",
    num: "05",
    name: "BudgetPro",
    category: "Native iOS · UIKit · MVVM",
    description:
      "A personal finance and budget tracking app with Core Data persistence. Helps users manage expenses, track income, and visualize spending patterns.",
    contributions: [
      "Integrated Firebase Authentication and Google Sign-In",
      "Persisted transactions and categories with Core Data",
      "Structured features with MVVM ViewModels for auth, home, and transactions",
      "Built expense entry, category management, statistics, and profile screens",
      "Crafted custom table and collection cells with onboarding carousel UI",
    ],
    image: "/images/budget_pro.png",
    alt: "BudgetPro finance dashboard graphic",
    repoUrl: "https://github.com/rohit0007ch/BudgetPro",
  },
  {
    id: "fitness-app",
    num: "06",
    name: "FitnessApp",
    category: "Native iOS · UIKit · MVC",
    description:
      "A fitness tracking app that monitors workouts and progress using UserDefaults and MVC. Track exercises, sessions, leaderboards, and user profiles.",
    contributions: [
      "Implemented local authentication and session state with UserDefaults",
      "Built tab-based navigation for activity, sessions, leaderboard, and settings",
      "Added workout tracking, past sessions, and device search flows",
      "Created profile setup, update, and sign-up onboarding screens",
      "Refined boxing-themed UI assets and storyboard-driven navigation",
    ],
    image: "/images/fitness_app.png",
    alt: "FitnessApp dashboard screen",
    repoUrl: "https://github.com/rohit0007ch/FitnessApp",
  },
];

export const GITHUB_PROFILE_URL = "https://github.com/rohit0007ch";
