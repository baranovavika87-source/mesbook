import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import ChatsPage from '@/pages/chats';
import ChatPage from '@/pages/chat';
import WallPage from '@/pages/wall';
import SettingsPage from '@/pages/settings';
import NotFound from '@/pages/not-found';
import AuthPage from '@/pages/auth';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';


const queryClient = new QueryClient();
function ProtectedRoute({ component: Component, path }: any) {
  const isAuthenticated = localStorage.getItem("mesbook_user");
  const [, setLocation] = useLocation();

  if (!isAuthenticated) {
    setTimeout(() => setLocation("/auth"), 0);
    return null;
  }

  return <Route path={path} component={Component} />;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
              <Switch>
          <ProtectedRoute path="/" component={ChatsPage} />
          <ProtectedRoute path="/chat/:chatId" component={ChatPage} />
          <ProtectedRoute path="/wall" component={WallPage} />
          <ProtectedRoute path="/settings" component={SettingsPage} />
          <Route path="/auth" component={AuthPage} />
          <Route component={NotFound} />
        </Switch>
     
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
