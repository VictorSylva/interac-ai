import React, { useState } from 'react';
import AdminLayout from '../../components/SuperAdmin/AdminLayout';
import DashboardModule from '../../components/SuperAdmin/Modules/DashboardModule';
import BusinessesModule from '../../components/SuperAdmin/Modules/BusinessesModule';
import EntitlementsModule from '../../components/SuperAdmin/Modules/EntitlementsModule';
import InvoicesModule from '../../components/SuperAdmin/Modules/InvoicesModule';
import AuditLeadsModule from '../../components/SuperAdmin/Modules/AuditLeadsModule';
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
      case 'entitlements':
        return <EntitlementsModule />;
      case 'invoices':
        return <InvoicesModule />;
      case 'leads':
        return <AuditLeadsModule />;
      case 'payments':
        return <PaymentsModule />;
      case 'logs':
        return <LogsModule />;
      case 'support':
        return <SupportToolsModule />;
      default:
        return <DashboardModule />;
    }
  };

  return (
    <AdminLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="animate-in fade-in duration-300">
        {renderModule()}
      </div>
    </AdminLayout>
  );
}
