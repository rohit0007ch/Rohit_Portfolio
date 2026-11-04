import { lazy, Suspense } from "react";
import "./App.css";
import { useVisitorTracking } from "./hooks/useVisitorTracking";
import { LoadingProvider } from "./context/LoadingProvider";
import "./pages/analytics/analytics.css";

const CharacterModel = lazy(() => import("./components/Character"));
const MainContainer = lazy(() => import("./components/MainContainer"));
const AnalyticsDashboard = lazy(() => import("./pages/AnalyticsDashboard"));

function isAnalyticsPath(pathname: string): boolean {
  return (
    pathname === "/analytics" ||
    pathname.startsWith("/analytics/")
  );
}

const PortfolioApp = () => {
  useVisitorTracking();

  return (
    <LoadingProvider>
      <Suspense>
        <MainContainer>
          <Suspense>
            <CharacterModel />
          </Suspense>
        </MainContainer>
      </Suspense>
    </LoadingProvider>
  );
};

const App = () => {
  const analytics = isAnalyticsPath(window.location.pathname);

  if (analytics) {
    return (
      <Suspense
        fallback={
          <div className="analytics-root">
            <div className="analytics-shell">
              <div className="analytics-state">Initializing telemetry…</div>
            </div>
          </div>
        }
      >
        <AnalyticsDashboard />
      </Suspense>
    );
  }

  return <PortfolioApp />;
};

export default App;
