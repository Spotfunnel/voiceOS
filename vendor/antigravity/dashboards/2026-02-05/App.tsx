
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { OperationsPage } from "./page_shells/operations/OperationsPage";
import { NewAgentPage } from "./page_shells/new_agent/NewAgentPage";
import { ConfigurePage } from "./page_shells/configure/ConfigurePage";
import { QualityPage } from "./page_shells/quality/QualityPage";
import { IntelligencePage } from "./page_shells/intelligence/IntelligencePage";
import { CustomerOverview } from "./customer_pages/dashboard/CustomerOverview";
import { CustomerActionRequired } from "./customer_pages/dashboard/CustomerActionRequired";
import { CustomerConfiguration } from "./customer_pages/dashboard/CustomerConfiguration";
import { CustomerCallLogs } from "./customer_pages/dashboard/CustomerCallLogs";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/customer/dashboard" replace />} />

                {/* Admin Pages */}
                <Route path="/operations" element={<OperationsPage />} />
                <Route path="/new-agent" element={<NewAgentPage />} />
                <Route path="/configure" element={<ConfigurePage />} />
                <Route path="/quality" element={<QualityPage />} />
                <Route path="/intelligence" element={<IntelligencePage />} />

                {/* Customer Pages */}
                <Route path="/customer/dashboard" element={<CustomerOverview />} />
                <Route path="/customer/action-required" element={<CustomerActionRequired />} />
                <Route path="/customer/configuration" element={<CustomerConfiguration />} />
                <Route path="/customer/call-logs" element={<CustomerCallLogs />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
