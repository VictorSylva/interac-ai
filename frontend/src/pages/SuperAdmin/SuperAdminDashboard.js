import React, { useState } from 'react';
import AdminLayout from '../../components/SuperAdmin/AdminLayout';
import DashboardModule from '../../components/SuperAdmin/Modules/DashboardModule';
import BusinessesModule from '../../components/SuperAdmin/Modules/BusinessesModule';
import PaymentsModule from '../../components/SuperAdmin/Modules/PaymentsModule';
import LogsModule from '../../components/SuperAdmin/Modules/LogsModule';
import SupportToolsModule from '../../components/SuperAdmin/Modules/SupportToolsModule';

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderModule = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardModule />;
      case 'businesses':
        return <BusinessesModule />;
      case 'payments':
        return <PaymentsModule />;
      case 'logs':
        return <LogsModule />;
      case 'support':
        return <SupportToolsModule />;
      case 'subscriptions':
        return (
          <div className="p-8">
            <h2 className="text-2xl font-bold text-navy mb-4">Subscription Plans</h2>
            <div className="bg-white p-12 rounded-3xl border border-grey-medium text-center">
              <p className="text-grey-500 italic">Plan management module is coming soon.</p>
            </div>
          </div>
        );
      case 'users':
        return (
          <div className="p-8">
            <h2 className="text-2xl font-bold text-navy mb-4">Admin Access Control</h2>
            <div className="bg-white p-12 rounded-3xl border border-grey-medium text-center">
              <p className="text-grey-500 italic">RBAC management module is coming soon.</p>
            </div>
          </div>
        );
      default:
        return <DashboardModule />;
    }
  };

  return (
    <AdminLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="animate-in fade-in duration-500">
        {renderModule()}
      </div>
    </AdminLayout>
  );
}
