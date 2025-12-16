import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BottomNav } from "./components/BottomNav";
import Home from "./pages/Home";
import Friends from "./pages/Friends";
import Calendar from "./pages/Calendar";
import MapPage from "./pages/MapPage";
import Stats from "./pages/Stats";
import Upload from "./pages/Upload";
import Detail from "./pages/Detail";
import Edit from "./pages/Edit";
import { useAuth } from "./_core/hooks/useAuth";
import { getLoginUrl } from "./const";
import { useEffect } from "react";
import { useLocation } from "wouter";

function Router() {
  const { isAuthenticated, loading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <div className="pb-16">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/friends" component={Friends} />
          <Route path="/calendar" component={Calendar} />
          <Route path="/map" component={MapPage} />
          <Route path="/stats" component={Stats} />
          <Route path="/upload" component={Upload} />
          <Route path="/detail/:id" component={Detail} />
          <Route path="/edit/:id" component={Edit} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </div>
      <BottomNav />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
