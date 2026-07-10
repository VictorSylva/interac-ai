import React from 'react';
import SuperAdminSidebar from './SuperAdminSidebar';

const AdminLayout = ({ children, activeTab, setActiveTab }) => {
  return (
    <div className="flex h-screen bg-grey-light overflow-hidden">
      {/* Sidebar */}
      <SuperAdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Placeholder (Can add search/notifications here later) */}
        <header className="h-16 bg-white border-b border-grey-medium flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-2">
            <span className="text-grey-500 font-medium capitalize">{activeTab}</span>
            <span className="text-grey-300">/</span>
            <span className="text-navy font-bold">Manage</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs font-bold text-grey-600">Production Mode</span>
             </div>
             <div className="w-8 h-8 rounded-full bg-grey-light border border-grey-medium flex items-center justify-center overflow-hidden">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" alt="Admin Avatar" />
             </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-y-auto bg-[#F8F9FB]">
           {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
