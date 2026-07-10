import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';

const SalesDashboard = () => {
    const { currentUser } = useAuth();
    const [isEmailActive, setIsEmailActive] = useState(true); // Assume active unless proven otherwise

    useEffect(() => {
        if (currentUser) {
            checkEmailStatus();
        }
    }, [currentUser]);

    const checkEmailStatus = async () => {
        const businessId = currentUser?.business_id || currentUser?.email || "default";
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
        try {
            const res = await fetch(`${apiUrl}/api/email/config?business_id=${encodeURIComponent(businessId)}`);
            const data = await res.json();
            if (data.status === "success" && data.config) {
                setIsEmailActive(data.config.is_active);
            } else {
                setIsEmailActive(false);
            }
        } catch (error) {
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="border-b bg-white px-6 py-4">
                <h1 className="text-2xl font-bold mb-4 text-navy">Commerce & Sales</h1>
                <div className="flex gap-6">
                    <NavLink 
                        to="/dashboard/sales/offers" 
                        className={({ isActive }) => 
                            `pb-4 font-medium border-b-2 transition-all ${isActive ? 'border-navy text-navy font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'}`
                        }
                    >
                        Offers
                    </NavLink>
                    <NavLink 
                        to="/dashboard/sales/orders" 
                        className={({ isActive }) => 
                            `pb-4 font-medium border-b-2 transition-all ${isActive ? 'border-navy text-navy font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'}`
                        }
                    >
                        Orders
                    </NavLink>
                    <NavLink 
                        to="/dashboard/sales/email-setup" 
                        className={({ isActive }) => 
                            `pb-4 font-medium border-b-2 transition-all flex items-center gap-2 ${isActive ? 'border-navy text-navy font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'}`
                        }
                    >
                        Email Setup
                        {!isEmailActive && <AlertCircle size={14} className="text-amber-500 animate-pulse" title="Configuration inactive" />}
                    </NavLink>
                </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-gray-50">
                <Outlet context={{ refreshEmailStatus: checkEmailStatus }} />
            </div>
        </div>
    );
};

export default SalesDashboard;

