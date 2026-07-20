/**
 * InteracAI Navigation Registry Utility
 * Manages base platform navigation and dynamic industry module route injections.
 */

export const BASE_NAVIGATION = [
  { id: 'home', label: 'Home Overview', path: '/dashboard', icon: 'Home' },
  { id: 'automation', label: 'Automations', path: '/automations', icon: 'Zap' },
  { id: 'conversations', label: 'Conversations', path: '/conversations', icon: 'MessageSquare' },
  { id: 'customers', label: 'Customers & CRM', path: '/leads', icon: 'Users' },
  { id: 'workflows', label: 'Workflow Engine', path: '/workflows', icon: 'GitMerge' },
  { id: 'knowledge', label: 'Knowledge Base', path: '/knowledge', icon: 'Book' },
  { id: 'security', label: 'ARGUS Security', path: '/security', icon: 'Shield' },
  { id: 'analytics', label: 'Analytics & Risk', path: '/analytics', icon: 'BarChart' }
];

/**
 * Returns combined base navigation and active industry module routes.
 * @param {Array} installedModules List of module manifests installed for active organization
 */
export const getActiveNavigation = (installedModules = []) => {
  const combined = [...BASE_NAVIGATION];

  if (!Array.isArray(installedModules)) return combined;

  installedModules.forEach((mod) => {
    if (mod.ui_extensions && Array.isArray(mod.ui_extensions.routes)) {
      mod.ui_extensions.routes.forEach((route) => {
        combined.push({
          id: `mod_${mod.id}_${route.path}`,
          label: route.title,
          path: route.path,
          icon: route.icon || 'Boxes',
          badge: mod.name,
          isModuleExtension: true
        });
      });
    }
  });

  return combined;
};
