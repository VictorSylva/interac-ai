import React, { useState, useCallback, useEffect } from "react";
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { useParams, useNavigate } from "react-router-dom";
import { Save, ArrowLeft, Plus } from "lucide-react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";
import { CustomNode } from "../components/WorkflowNodes";

const nodeTypes = {
  custom: CustomNode,
};

const defaultViewport = { x: 0, y: 0, zoom: 1.5 };

export default function WorkflowBuilder() {
  const { id } = useParams(); // 'new' or UUID
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // ReactFlow Hooks
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Metadata State
  const [workflowName, setWorkflowName] = useState("New Workflow");
  const [triggerType, setTriggerType] = useState("keyword_detected");
  const [triggerConfig, setTriggerConfig] = useState({ keywords: [] });
  const [saving, setSaving] = useState(false);

  // Initialize
  useEffect(() => {
    if (id && id !== "new") {
      fetchWorkflow(id);
    } else {
      // Default Start Node
      setNodes([
        {
          id: `node_start_${Date.now()}`,
          type: "custom",
          data: { label: "Start Trigger", backendType: "start" },
          position: { x: 250, y: 50 },
        },
      ]);
    }
  }, [id]);

  const fetchWorkflow = async (workflowId) => {
    const businessId = currentUser?.business_id || currentUser?.email || "default";
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    try {
      const res = await fetch(
        `${apiUrl}/api/workflows?business_id=${businessId}`
      );
      if (!res.ok) throw new Error("Failed to fetch workflows");
      const data = await res.json();
      const wf = data.find((w) => w.id === workflowId);

      if (wf) {
        setWorkflowName(wf.name);
        setTriggerType(wf.trigger_type);
        setTriggerConfig(wf.trigger_config || {});
        if (wf.definition) {
          setNodes(wf.definition.nodes || []);
          setEdges(wf.definition.edges || []);
        }
      }
    } catch (err) {
    }
  };

  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            markerEnd: { type: MarkerType.ArrowClosed },
            // Default edge logic options
            data: { condition: null },
          },
          eds
        )
      ),
    [setEdges]
  );

  const onSave = async () => {
    setSaving(true);
    // Consistent ID logic: use email as primary for MVP if business_id is flaky
    const businessId = currentUser?.email || "default";

    const payload = {
      business_id: businessId,
      name: workflowName,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      // We verify and serialize the graph to the Definition JSON
      // AND the backend likely needs to sync SQL Nodes.
      // Our backend `create_workflow` logic handles `{ nodes: [], edges: [] }` in the payload
      // and converts them to SQL rows.
      nodes: nodes.map((n) => ({
        id: n.id,
        type: mapNodeType(n),
        label: n.data.label,
        config: n.data.config || {},
        position_x: n.position.x,
        position_y: n.position.y,
        platform_meta: n.position,
      })),
      edges: edges.map((e) => ({
        source_id: e.source,
        target_id: e.target,
        // Prioritize data.condition (which stores "true"/"false"), fallback to label (if user typed)
        condition_value: e.data?.condition || e.label || null,
      })),
      is_active: true,
    };

    // Definition blob for UI restoration (positions etc)
    payload.definition = { nodes, edges };

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("Workflow Saved!");
        navigate("/dashboard/automations");
      } else {
        alert("Failed to save.");
      }
    } catch (err) {
      alert("Error saving.");
    } finally {
      setSaving(false);
    }
  };

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);

  const onNodeClick = (event, node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null); // Deselect edge
  };

  const onEdgeClick = (event, edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null); // Deselect node
  };

  const updateNodeConfig = (key, value) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNodeId) {
          const newConfig = { ...node.data.config, [key]: value };
          return {
            ...node,
            data: { ...node.data, config: newConfig },
          };
        }
        return node;
      })
    );
  };

  const updateEdgeConfig = (label) => {
    if (!selectedEdgeId) return;
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === selectedEdgeId) {
          // Update label and data
          // Logic: "true" -> Label "Yes", "false" -> Label "No"
          return {
            ...edge,
            label: label === "true" ? "Yes" : label === "false" ? "No" : "",
            data: { ...edge.data, condition: label }, // Save "true"/"false" string for backend
          };
        }
        return edge;
      })
    );
  };

  const deleteEdge = () => {
    if (!selectedEdgeId) return;
    setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
    setSelectedEdgeId(null);
  };

  const deleteNode = () => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) =>
      eds.filter(
        (e) => e.source !== selectedNodeId && e.target !== selectedNodeId
      )
    );
    setSelectedNodeId(null);
  };

  const getSelectedNode = () => nodes.find((n) => n.id === selectedNodeId);
  const getSelectedEdge = () => edges.find((e) => e.id === selectedEdgeId);

  const mapNodeType = (node) => {
    return node.data.backendType || "action";
  };

  const addNode = (type, label) => {
    const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNode = {
      id,
      type: "custom",
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: { label: label || "New Node", backendType: type, config: {} },
    };
    
    // Auto-switch trigger type if a specialized trigger node is added
    if (type === "sales_trigger") {
        setTriggerType("sales_trigger");
    }

    setNodes((nds) => [...nds, newNode]);
  };


  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      {/* Header Toolbar */}
      <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:bg-gray-100 p-2 rounded-full"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="text-lg font-bold border-none focus:ring-0 p-0"
              placeholder="Workflow Name"
            />
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
              Trigger Type:
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value)}
                className="border-gray-200 rounded text-xs py-0.5 bg-gray-50 font-bold text-navy"
              >
                <option value="keyword_detected">💬 Keyword Detection</option>
                <option value="intent_detected">🧠 AI Intent Match</option>
                <option value="ai_sentiment">🎭 Sentiment Analysis</option>
                <option value="sales_trigger">💰 Sales & eCommerce</option>
                <option value="intelligence_event">👁️ Physical Intelligence Event</option>
                <option value="manual">🔘 Manual / API</option>
              </select>
              
              {(triggerType === "keyword_detected" || triggerType === "keyword") && (
                <input
                  value={(triggerConfig.keywords || (triggerConfig.keyword ? [triggerConfig.keyword] : [])).join(", ")}
                  onChange={(e) =>
                    setTriggerConfig({ keywords: e.target.value.split(",").map(k => k.trim()) })
                  }
                  placeholder="human, agent, help..."
                  className="border border-gray-200 rounded px-2 py-0.5 text-xs bg-navy/5 focus:bg-white transition-all"
                />
              )}

              {(triggerType === "intent_detected" || triggerType === "intent") && (
                <input
                  value={triggerConfig.intent_detected || ""}
                  onChange={(e) =>
                    setTriggerConfig({ intent_detected: e.target.value })
                  }
                  placeholder="support_request"
                  className="border border-gray-200 rounded px-2 py-0.5 text-xs bg-navy/5 focus:bg-white transition-all"
                />
              )}

              {triggerType === "ai_sentiment" && (
                <div className="flex items-center gap-1">
                    <select 
                        value={triggerConfig.ai_sentiment?.sentiment || "negative"}
                        onChange={(e) => setTriggerConfig({ ai_sentiment: { ...triggerConfig.ai_sentiment, sentiment: e.target.value }})}
                        className="border-none bg-transparent text-[10px] font-bold"
                    >
                        <option value="negative">Negative</option>
                        <option value="neutral">Neutral</option>
                        <option value="positive">Positive</option>
                    </select>
                    <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={triggerConfig.ai_sentiment?.threshold || 0.7}
                        onChange={(e) => setTriggerConfig({ ai_sentiment: { ...triggerConfig.ai_sentiment, threshold: parseFloat(e.target.value) }})}
                        className="w-10 border border-gray-200 rounded px-1 py-0.5 text-[10px]"
                    />
                </div>
              )}

              {triggerType === "sales_trigger" && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">
                      Live Sales Monitoring Active
                  </span>
              )}

              {triggerType === "intelligence_event" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">
                    Live Camera Grid Active
                  </span>
                  <input
                    value={triggerConfig.event_type || ""}
                    onChange={(e) =>
                      setTriggerConfig({ event_type: e.target.value })
                    }
                    placeholder="Event (e.g. intrusion) or leave empty for all"
                    className="border border-gray-200 rounded px-2 py-0.5 text-xs bg-navy/5 focus:bg-white transition-all w-64"
                  />
                </div>
              )}
            </div>

          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="bg-navy hover:bg-navy-light text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={18} /> Save
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Palette */}
        <div className="w-48 bg-gray-50 border-r border-gray-200 p-4 flex flex-col gap-2 overflow-y-auto">
          <p className="text-xs font-bold text-green-600 uppercase mb-2">
            Sales & Commerce
          </p>
          <button
            onClick={() => addNode("sales_trigger", "Payment Received")}
            className="text-sm bg-white border p-2 rounded shadow-sm hover:border-green-500 text-left"
          >
            💰 Payment Success
          </button>
          <button
            onClick={() => addNode("sales_trigger", "Cart Abandoned")}
            className="text-sm bg-white border p-2 rounded shadow-sm hover:border-green-500 text-left"
          >
            🛒 Cart Abandoned
          </button>
          <button
            onClick={() => addNode("action", "Send Offer Link")}
            className="text-sm bg-white border p-2 rounded shadow-sm hover:border-blue-500 text-left"
          >
            🛍️ Send Offer Link
          </button>
          <button
            onClick={() => addNode("action", "Apply Discount")}
            className="text-sm bg-white border p-2 rounded shadow-sm hover:border-blue-500 text-left"
          >
            🏷️ Apply Discount
          </button>

          <p className="text-xs font-bold text-gray-400 uppercase mb-2 mt-4">
            Actions
          </p>
          <button
            onClick={() => addNode("action", "Send Message")}
            className="text-sm bg-white border p-2 rounded shadow-sm hover:border-navy text-left"
          >
            💬 Send Msg
          </button>
          <button
            onClick={() => addNode("action", "Send Email")}
            className="text-sm bg-white border p-2 rounded shadow-sm hover:border-navy text-left"
          >
            📧 Send Email
          </button>
          <button
            onClick={() => addNode("action", "Create Ticket")}
            className="text-sm bg-white border p-2 rounded shadow-sm hover:border-navy text-left"
          >
            🎫 Create Ticket
          </button>
          <button
            onClick={() => addNode("action", "Assign Agent")}
            className="text-sm bg-white border p-2 rounded shadow-sm hover:border-navy text-left"
          >
            👤 Assign Agent
          </button>
          <button
            onClick={() => addNode("appointment_booking", "Book Appointment")}
            className="text-sm bg-white border p-2 rounded shadow-sm hover:border-navy text-left"
          >
            📅 Book Appointment
          </button>
          <button
            onClick={() => addNode("lead_capture", "Lead Capture")}
            className="text-sm bg-white border p-2 rounded shadow-sm hover:border-navy text-left"
          >
            🧲 Lead Capture
          </button>
          <button
            onClick={() => addNode("escalate_to_human", "Handover to Human")}
            className="text-sm bg-white border p-2 rounded shadow-sm hover:border-red-500 text-left"
          >
            🎧 Escalate to Human
          </button>

          <p className="text-xs font-bold text-gray-400 uppercase mb-2 mt-4">
            Logic
          </p>
          <button
            onClick={() => addNode("condition", "Condition")}
            className="text-sm bg-white border p-2 rounded shadow-sm hover:border-orange-500 text-left"
          >
            ❓ Condition
          </button>
          <button
            onClick={() => addNode("wait_for_reply", "Wait for Reply")}
            className="text-sm bg-white border p-2 rounded shadow-sm hover:border-orange-500 text-left"
          >
            ⏳ Wait for Reply
          </button>
          <button
            onClick={() => addNode("time_delay", "Delay")}
            className="text-sm bg-white border p-2 rounded shadow-sm hover:border-orange-500 text-left"
          >
            ⏱️ Delay
          </button>

          <p className="text-xs font-bold text-gray-400 uppercase mb-2 mt-4">
            Intelligence
          </p>
          <button
            onClick={() => addNode("ai_inference", "AI Agent")}
            className="text-sm bg-white border p-2 rounded shadow-sm hover:border-purple-500 text-left"
          >
            🤖 AI Think
          </button>
          <button
            onClick={() => addNode("ai_extract", "AI Extract")}
            className="text-sm bg-white border p-2 rounded shadow-sm hover:border-purple-500 text-left"
          >
            🧠 AI Extract
          </button>
          <button
            onClick={() => addNode("http_request", "Webhook")}
            className="text-sm bg-white border p-2 rounded shadow-sm hover:border-purple-500 text-left"
          >
            🌐 Webhook
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            defaultViewport={defaultViewport}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* Config Panel */}
        {(selectedNodeId || selectedEdgeId) && (
          <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto shadow-xl z-10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">
                {selectedEdgeId ? "Edge Settings" : "Configuration"}
              </h3>
              <button
                onClick={() => {
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            {selectedEdgeId &&
              (() => {
                const edge = getSelectedEdge();
                if (!edge) return null;
                return (
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Branch Condition
                      </label>
                      <select
                        value={edge.data?.condition || ""}
                        onChange={(e) => updateEdgeConfig(e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        <option value="">(Always)</option>
                        <option value="true">True (Yes)</option>
                        <option value="false">False (No)</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1">
                        For usage with "Condition" nodes.
                      </p>
                    </div>
                    <div className="border-t border-gray-200 my-4"></div>
                    <button
                      onClick={deleteEdge}
                      className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded text-sm hover:bg-red-100"
                    >
                      Delete Connection
                    </button>
                  </div>
                );
              })()}

            {selectedNodeId &&
              (() => {
                const node = getSelectedNode();
                if (!node) return null;
                const type = node.data.backendType;

                return (
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Label
                      </label>
                      <input
                        value={node.data.label}
                        onChange={(e) => {
                          setNodes((nds) =>
                            nds.map((n) =>
                              n.id === node.id
                                ? {
                                    ...n,
                                    data: { ...n.data, label: e.target.value },
                                  }
                                : n
                            )
                          );
                        }}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    </div>

                    {/* --- Actions --- */}
                    {type === "action" &&
                      node.data.label === "Send Message" && (
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            Template
                          </label>
                          <textarea
                            value={node.data.config.template || ""}
                            onChange={(e) =>
                              updateNodeConfig("template", e.target.value)
                            }
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm h-32"
                            placeholder="Hello {name}..."
                            onFocus={() =>
                              updateNodeConfig("action_type", "send_message")
                            }
                          />
                        </div>
                      )}

                    {type === "action" &&
                      node.data.label === "Send Email" && (
                        <>
                          <InputField
                            label="Recipient Email"
                            value={node.data.config.to}
                            onChange={(v) => updateNodeConfig("to", v)}
                            placeholder="{{customer_email}}"
                          />
                          <InputField
                            label="Subject"
                            value={node.data.config.subject}
                            onChange={(v) => updateNodeConfig("subject", v)}
                            placeholder="Your Order Fulfillment"
                          />
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                              Body (HTML supported)
                            </label>
                            <textarea
                              value={node.data.config.body || ""}
                              onChange={(e) =>
                                updateNodeConfig("body", e.target.value)
                              }
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm h-32 font-mono"
                              placeholder="Hello {{customer_email}},\n\nThank you for purchasing {{offer_title}}..."
                              onFocus={() =>
                                updateNodeConfig("action_type", "send_email")
                              }
                            />
                            <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">Available tags: {"{{customer_email}}"}, {"{{offer_title}}"}, {"{{amount}}"}</p>
                          </div>
                        </>
                      )}

                    {type === "action" &&
                      node.data.label === "Create Ticket" && (
                        <>
                          <InputField
                            label="Subject"
                            value={node.data.config.subject}
                            onChange={(v) => updateNodeConfig("subject", v)}
                            placeholder="Ticket Subject"
                          />
                          <InputField
                            label="Description"
                            value={node.data.config.description}
                            onChange={(v) => updateNodeConfig("description", v)}
                            placeholder="Issue details..."
                          />
                          <div
                            onFocus={() =>
                              updateNodeConfig("action_type", "create_ticket")
                            }
                          ></div>
                        </>
                      )}

                    {type === "action" &&
                      node.data.label === "Assign Agent" && (
                        <>
                          <InputField
                            label="Agent ID"
                            value={node.data.config.agent_id}
                            onChange={(v) => updateNodeConfig("agent_id", v)}
                            placeholder="UUID of agent"
                          />
                          <div
                            onFocus={() =>
                              updateNodeConfig("action_type", "assign_agent")
                            }
                          ></div>
                        </>
                      )}

                    {type === "escalate_to_human" && (
                      <>
                        <InputField
                          label="Assign Agent (Optional ID)"
                          value={node.data.config.agent_id}
                          onChange={(v) => updateNodeConfig("agent_id", v)}
                          placeholder="Agent UUID"
                        />
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            Transition Message
                          </label>
                          <textarea
                            value={node.data.config.message || ""}
                            onChange={(e) =>
                              updateNodeConfig("message", e.target.value)
                            }
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm h-24"
                            placeholder="I'm transferring you to a human agent..."
                          />
                        </div>
                      </>
                    )}

                    {type === "lead_capture" && (
                      <>
                        <InputField
                          label="Name (Optional)"
                          value={node.data.config.name}
                          onChange={(v) => updateNodeConfig("name", v)}
                          placeholder="Override name"
                        />
                        <div className="mb-3">
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            Tags (Comma Separated)
                          </label>
                          <input
                            value={(node.data.config.tags || []).join(", ")}
                            onChange={(e) =>
                              updateNodeConfig(
                                "tags",
                                e.target.value
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter((s) => s)
                              )
                            }
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            placeholder="vip, new_lead"
                          />
                        </div>
                      </>
                    )}

                    {type === "appointment_booking" && (
                      <>
                        <InputField
                          label="Appointment Type ID (Optional)"
                          value={node.data.config.appointment_type_id}
                          onChange={(v) => updateNodeConfig("appointment_type_id", v)}
                          placeholder="UUID of type"
                        />
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                          System will auto-propose available slots if ID is empty.
                        </p>
                      </>
                    )}

                    {/* --- Logic --- */}
                    {type === "time_delay" && (
                      <InputField
                        label="Seconds"
                        type="number"
                        value={node.data.config.seconds}
                        onChange={(v) => updateNodeConfig("seconds", v)}
                      />
                    )}

                    {type === "condition" && (
                      <>
                        <InputField
                          label="Variable"
                          value={node.data.config.variable}
                          onChange={(v) => updateNodeConfig("variable", v)}
                          placeholder="e.g. ai_extract.email"
                        />
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            Operator
                          </label>
                          <select
                            value={node.data.config.operator || "contains"}
                            onChange={(e) =>
                              updateNodeConfig("operator", e.target.value)
                            }
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          >
                            <option value="contains">Contains</option>
                            <option value="equals">Equals</option>
                            <option value="greater_than">Greater Than</option>
                            <option value="exists">Exists</option>
                          </select>
                        </div>
                        <InputField
                          label="Value"
                          value={node.data.config.value}
                          onChange={(v) => updateNodeConfig("value", v)}
                          placeholder="Comparison value"
                        />
                      </>
                    )}

                    {/* --- Intelligence --- */}
                    {type === "ai_inference" && (
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                          Prompt Template
                        </label>
                        <textarea
                          value={node.data.config.prompt_template || ""}
                          onChange={(e) =>
                            updateNodeConfig("prompt_template", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm h-32"
                          placeholder="Analyze this text..."
                        />
                      </div>
                    )}

                    {type === "ai_extract" && (
                      <FieldsEditor
                        value={node.data.config.fields || []}
                        onChange={(newFields) =>
                          updateNodeConfig("fields", newFields)
                        }
                      />
                    )}

                    {type === "http_request" && (
                      <>
                        <InputField
                          label="URL"
                          value={node.data.config.url}
                          onChange={(v) => updateNodeConfig("url", v)}
                          placeholder="https://api.example.com"
                        />
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            Method
                          </label>
                          <select
                            value={node.data.config.method || "POST"}
                            onChange={(e) =>
                              updateNodeConfig("method", e.target.value)
                            }
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                          </select>
                        </div>
                        <JsonInput
                          label="Headers (JSON)"
                          value={node.data.config.headers}
                          onChange={(v) => updateNodeConfig("headers", v)}
                          placeholder='{"Content-Type": "application/json"}'
                        />
                        <JsonInput
                          label="Body (JSON)"
                          value={node.data.config.body}
                          onChange={(v) => updateNodeConfig("body", v)}
                          placeholder='{"data": "{ai_output}"}'
                        />
                      </>
                    )}

                    <div className="border-t border-gray-200 my-4"></div>
                    <button
                      onClick={deleteNode}
                      className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded text-sm hover:bg-red-100"
                    >
                      Delete Node
                    </button>
                  </div>
                );
              })()}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Helper Components (Defined Outside to prevent Remounting) ---

const InputField = ({ label, value, onChange, placeholder, type = "text" }) => (
  <div className="mb-3">
    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
      {label}
    </label>
    <input
      type={type}
      value={value || ""}
      onChange={(e) =>
        onChange(type === "number" ? parseInt(e.target.value) : e.target.value)
      }
      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
      placeholder={placeholder}
    />
  </div>
);

const JsonInput = ({ label, value, onChange, placeholder }) => {
  const [localValue, setLocalValue] = useState(
    JSON.stringify(value || {}, null, 2)
  );
  const [error, setError] = useState(null);

  // Sync external changes (only if not focused ideally, but simple effect helps init)
  useEffect(() => {
    // Only update if external value differs significantly to avoid cursor jumps on valid parses
    // Actually, for JSON, better to only init.
    // We'll trust local state for edits.
    setLocalValue(JSON.stringify(value || {}, null, 2));
  }, [value]);

  // Better pattern: Re-initialize when `value` prop changes ID, not content deep check.
  // But since `value` is an object, reference changes.
  // Let's rely on simple Blur commit pattern.

  const handleBlur = () => {
    try {
      const parsed = JSON.parse(localValue);
      onChange(parsed);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="mb-3">
      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
        {label}
      </label>
      <textarea
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          setError(null);
        }}
        onBlur={handleBlur}
        className={`w-full border ${
          error ? "border-red-500" : "border-gray-300"
        } rounded px-2 py-1 text-sm h-32 font-mono`}
        placeholder={placeholder}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <p className="text-xs text-gray-400">
        Edit JSON and click outside to save.
      </p>
    </div>
  );
};

const FieldsEditor = ({ value = [], onChange }) => {
  const addField = () => onChange([...value, { name: "", type: "string" }]);
  const removeField = (idx) => onChange(value.filter((_, i) => i !== idx));
  const updateField = (idx, key, val) => {
    const newFields = [...value];
    newFields[idx] = { ...newFields[idx], [key]: val };
    onChange(newFields);
  };

  return (
    <div className="mb-3">
      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
        Extraction Fields
      </label>
      <div className="flex flex-col gap-2 mb-2">
        {value.map((field, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <input
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder="Field Name"
              value={field.name}
              onChange={(e) => updateField(idx, "name", e.target.value)}
            />
            <select
              className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
              value={field.type}
              onChange={(e) => updateField(idx, "type", e.target.value)}
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="email">Email</option>
              <option value="boolean">Boolean</option>
            </select>
            <button
              onClick={() => removeField(idx)}
              className="text-gray-400 hover:text-red-500 px-1"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={addField}
        className="text-sm text-navy hover:underline font-medium"
      >
        + Add Field
      </button>
    </div>
  );
};
