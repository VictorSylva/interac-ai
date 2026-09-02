import React, { useState } from 'react';
import AdminLayout from '../../components/SuperAdmin/AdminLayout';
import {
  DashboardModule,
  BusinessesModule,
  EntitlementsModule,
  InvoicesModule,
  AuditLeadsModule,
  PaymentsModule,
  LogsModule,
  SupportToolsModule
} from '../../components/SuperAdmin/Modules';

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
