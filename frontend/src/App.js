
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import DashboardLayout from './components/DashboardLayout';
import DashboardOverview from './pages/DashboardOverview'; // Placeholder
import Conversations from './pages/Conversations';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import AcceptInvitation from './pages/AcceptInvitation';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Analytics from './pages/Analytics';
import BehaviorAnalytics from './pages/BehaviorAnalytics';
// import Automations from './pages/Automations'; // Deprecated
import WorkflowList from './pages/WorkflowList';
import WorkflowBuilder from './pages/WorkflowBuilder';
import WorkflowHistory from './pages/WorkflowHistory';
import BusinessProfile from './pages/BusinessProfile';
import WhatsAppSetup from './pages/WhatsAppSetup';
import MetaChannelsSetup from './pages/MetaChannelsSetup'; // Omnichannel (Instagram, Messenger, Facebook)
import Leads from './pages/Leads';
import Scheduling from './pages/Scheduling';
import SecurityIntelligence from './pages/SecurityIntelligence';
import SuperAdminDashboard from './pages/SuperAdmin/SuperAdminDashboard';
import IndustryDemo from './pages/IndustryDemo';
import DemoMultiBusinessPage from './pages/DemoMultiBusinessPage';

import SalesDashboard from './pages/Sales/SalesDashboard';
import Offers from './pages/Sales/Offers';
import Orders from './pages/Sales/Orders';
import EmailSetup from './pages/Sales/EmailSetup';
import SalesPageTemplate from './pages/SalesPageTemplate';
import Subscription from './pages/Subscription';

// Super Admin components are now self-orchestrated

import IndustryModulesPage from './pages/IndustryModulesPage';
import IndustryExtensionPage from './pages/IndustryExtensionPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/accept-invitation" element={<AcceptInvitation />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<DashboardOverview />} />
            <Route path="conversations" element={<Conversations />} />
            <Route path="leads" element={<Leads />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="behavior-analytics" element={<BehaviorAnalytics />} />
            <Route path="automations" element={<WorkflowList />} />
            <Route path="workflows/new" element={<WorkflowBuilder />} />
            <Route path="workflows/:id" element={<WorkflowBuilder />} />
            <Route path="workflows/:id/history" element={<WorkflowHistory />} />
            <Route path="profile" element={<BusinessProfile />} />

            <Route path="modules" element={<IndustryModulesPage />} />
            <Route path="hotels/*" element={<IndustryExtensionPage />} />
            <Route path="irs/*" element={<IndustryExtensionPage />} />
            <Route path="retail/*" element={<IndustryExtensionPage />} />
            <Route path="estate/*" element={<IndustryExtensionPage />} />
            <Route path="hospital/*" element={<IndustryExtensionPage />} />
            <Route path="bible_translation/*" element={<IndustryExtensionPage />} />
            <Route path="church/*" element={<IndustryExtensionPage />} />
            <Route path="government/*" element={<IndustryExtensionPage />} />
            <Route path="manufacturing/*" element={<IndustryExtensionPage />} />
            <Route path="education/*" element={<IndustryExtensionPage />} />
            <Route path="agriculture/*" element={<IndustryExtensionPage />} />
            <Route path="whatsapp-setup" element={<WhatsAppSetup />} />
            <Route path="meta-setup" element={<MetaChannelsSetup />} />



            <Route path="scheduling" element={<Scheduling />} />
            <Route path="intelligence" element={<SecurityIntelligence />} />
            <Route path="sales" element={<SalesDashboard />}>
              <Route index element={<Offers />} />
              <Route path="offers" element={<Offers />} />
              <Route path="orders" element={<Orders />} />
              <Route path="email-setup" element={<EmailSetup />} />
            </Route>
            <Route path="subscription" element={<Subscription />} />
          </Route>

          
          <Route path="/super-admin" element={<ProtectedRoute requiredRole="super_admin"><SuperAdminDashboard /></ProtectedRoute>} />
          <Route path="/superadmin" element={<ProtectedRoute requiredRole="super_admin"><SuperAdminDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requiredRole="super_admin"><SuperAdminDashboard /></ProtectedRoute>} />
          <Route path="/demo" element={<DemoMultiBusinessPage />} />
          <Route path="/demo/:industry" element={<IndustryDemo />} />
          <Route path="/:businessSlug/:offerSlug" element={<SalesPageTemplate />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
