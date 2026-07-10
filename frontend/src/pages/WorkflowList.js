import { useCallback, useState, useEffect } from "react";
import { Plus, Play, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function WorkflowList() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = useCallback(async () => {
    const businessId = currentUser?.business_id || currentUser?.email || "default";
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    try {
      const response = await fetch(
        `${apiUrl}/api/workflows?business_id=${businessId}`,
      );
      if (response.ok) {
        const data = await response.json();
        setWorkflows(data);
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    // Always try to fetch, default to 'default' if no user
    fetchWorkflows();
  }, [currentUser, fetchWorkflows]);

  const handleDelete = async (e, workflowId) => {
    e.stopPropagation();
    const businessId = currentUser?.business_id || currentUser?.email || "default";
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';

    if (window.confirm("Are you sure you want to delete this workflow?")) {
      try {
        const res = await fetch(
          `${apiUrl}/api/workflows/${workflowId}?business_id=${businessId}`,
          {
            method: "DELETE",
          },
        );
        if (res.ok) {
          setWorkflows(workflows.filter((w) => w.id !== workflowId));
          alert("Workflow deleted.");
        } else {
          alert("Failed to delete.");
        }
      } catch (err) {
      }
    }
  };

  const handleTrigger = async (e, workflowId) => {
    e.stopPropagation();
    const businessId = currentUser?.business_id || currentUser?.email || "default";
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';

    const triggerData = {
      business_id: businessId,
      message: "Manual Trigger Test",
      source: "dashboard",
    };

    if (window.confirm("Trigger this workflow manually now?")) {
      try {
        const res = await fetch(
          `${apiUrl}/api/workflows/${workflowId}/trigger`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(triggerData),
          },
        );
        if (res.ok) {
          alert("Workflow Triggered! Check Execution History.");
        } else {
          alert("Failed to trigger.");
        }
      } catch (err) {
      }
    }
  };

  if (loading) return <div className="p-8">Loading Workflows...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy">Workflows</h1>
          <p className="text-gray-600">
            Automate your business logic with visual workflows.
          </p>
        </div>
        <button
          onClick={() => navigate("/dashboard/workflows/new")}
          className="bg-navy hover:bg-navy-light text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={20} />
          New Workflow
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workflows.map((wf) => (
          <div
            key={wf.id}
            onClick={() => navigate(`/dashboard/workflows/${wf.id}`)}
            className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-start mb-4">
              <div
                className={`p-2 rounded-lg ${wf.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
              >
                <Play size={20} />
              </div>
              <div className="relative">
                <button
                  onClick={(e) => handleDelete(e, wf.id)}
                  className="p-1 hover:bg-red-50 rounded-full text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <h3 className="font-bold text-lg text-gray-800 mb-1">{wf.name}</h3>
            <p className="text-sm text-gray-500 mb-4 line-clamp-2">
              {wf.description || "No description"}
            </p>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <span className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded">
                {wf.trigger_type}
              </span>

              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/dashboard/workflows/${wf.id}/history`);
                  }}
                  className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full font-medium hover:bg-gray-50 transition-colors"
                >
                  History
                </button>
                <button
                  onClick={(e) => handleTrigger(e, wf.id)}
                  className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full font-medium hover:bg-indigo-100 transition-colors"
                >
                  Run Now
                </button>
              </div>
            </div>
          </div>
        ))}

        {workflows.length === 0 && (
          <div className="col-span-full text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-gray-500 mb-4">No workflows found.</p>
            <button
              onClick={() => navigate("/dashboard/workflows/new")}
              className="text-navy font-semibold hover:underline"
            >
              Create your first workflow
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
