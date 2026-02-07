
import { BrainCircuit, Settings, LayoutDashboard, Activity, AlertCircle, PhoneList, Mic } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";

interface LayoutProps {
    children: React.ReactNode;
    activeResult?: string;
}

const NAV_ITEMS = [
    { header: "Admin Control" },
    { id: "operations", label: "Operations", icon: Activity, href: "/operations" },
    { id: "new_agent", label: "New Agent", icon: BrainCircuit, href: "/new-agent" },
    { id: "intelligence", label: "Intelligence", icon: BrainCircuit, href: "/intelligence" },
    { id: "configure", label: "Configure", icon: Settings, href: "/configure" },
    { id: "quality", label: "Quality", icon: LayoutDashboard, href: "/quality" },

    { header: "Customer Dashboard" },
    { id: "customer_dashboard", label: "Overview", icon: Activity, href: "/customer/dashboard" },
    { id: "customer_call_logs", label: "Call Logs", icon: PhoneList, href: "/customer/call-logs" },
    { id: "customer_actions", label: "Action Required", icon: AlertCircle, href: "/customer/action-required" },
    { id: "customer_config", label: "Configuration", icon: Settings, href: "/customer/configuration" },
];

export function DashboardLayout({ children, activeResult = "operations" }: LayoutProps) {
    const location = useLocation();

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100">
            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex-col hidden md:flex">
                <div className="p-6">
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                            <BrainCircuit size={20} />
                        </div>
                        SpotFunnel
                    </h1>
                </div>

                <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
                    {NAV_ITEMS.map((item, idx) => {
                        if (item.header) {
                            return (
                                <div key={idx} className="pt-4 pb-2 px-2">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{item.header}</p>
                                </div>
                            );
                        }

                        const Icon = item.icon!;
                        const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');

                        return (
                            <Link
                                key={item.id}
                                to={item.href!}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-primary text-white shadow-sm"
                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                                )}
                            >
                                <Icon size={18} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold">
                            JD
                        </div>
                        <div className="text-sm">
                            <p className="font-medium">John Doe</p>
                            <p className="text-xs text-slate-500">Admin</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
