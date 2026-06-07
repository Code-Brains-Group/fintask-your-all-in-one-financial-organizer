import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Transactions from "./pages/Transactions";
import Tasks from "./pages/Tasks";
import Settings from "./pages/Settings";
import Budgets from "./pages/Budgets";
import Savings from "./pages/Savings";
import Recurring from "./pages/Recurring";
import Reports from "./pages/Reports";
import Applications from "./pages/Applications";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import JoinGroup from "./pages/JoinGroup";
import Help from "./pages/Help";
import Admin from "./pages/Admin";
import Learning from "./pages/Learning";
import LearningDetail from "./pages/LearningDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/join/:code" element={<JoinGroup />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/groups" element={<Groups />} />
              <Route path="/groups/:id" element={<GroupDetail />} />
              <Route path="/" element={<Index />} />
              <Route path="/finance/transactions" element={<Transactions />} />
              <Route path="/finance/budgets" element={<Budgets />} />
              <Route path="/finance/savings" element={<Savings />} />
              <Route path="/finance/recurring" element={<Recurring />} />
              <Route path="/finance/reports" element={<Reports />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/tasks/board" element={<Tasks />} />
              <Route path="/tasks/dashboard" element={<Tasks />} />
              <Route path="/applications" element={<Applications />} />
              <Route path="/help" element={<Help />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
