import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout.tsx';
import { SetupPage } from './pages/SetupPage.tsx';
import { ApprovalPage } from './pages/ApprovalPage.tsx';
import { ReportPage } from './pages/ReportPage.tsx';
import { WorkerPage } from './pages/WorkerPage.tsx';
export default function App() {
    return (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/setup", element: _jsx(SetupPage, {}) }), _jsxs(Route, { element: _jsx(Layout, {}), children: [_jsx(Route, { path: "/", element: _jsx(ApprovalPage, {}) }), _jsx(Route, { path: "/report", element: _jsx(ReportPage, {}) }), _jsx(Route, { path: "/worker", element: _jsx(WorkerPage, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/" }) })] }) }));
}
