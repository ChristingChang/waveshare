import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BottomNav } from "./components/BottomNav";
import { AuthHeader } from "./components/AuthHeader";
import Landing from "./pages/Landing";
import Home from "./pages/Home";
import Friends from "./pages/Friends";
import Calendar from "./pages/Calendar";
import MapPage from "./pages/MapPage";
import Stats from "./pages/Stats";
import Upload from "./pages/Upload";
import Detail from "./pages/Detail";
import Edit from "./pages/Edit";
import { useAuth } from "./_core/hooks/useAuth";

function Router() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  return (
    <>
      <AuthHeader />
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
        <footer className="py-6 text-center text-sm text-muted-foreground">
          <a href="/privacy" className="underline">隱私權政策</a>
          {" · "}
          <a href="/terms" className="underline">服務條款</a>
        </footer>
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
