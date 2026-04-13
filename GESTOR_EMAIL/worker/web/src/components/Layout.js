import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.tsx';
export function Layout() {
    return (_jsxs("div", { style: { display: 'flex', height: '100vh', overflow: 'hidden' }, children: [_jsx(Sidebar, {}), _jsx("main", { style: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }, children: _jsx(Outlet, {}) })] }));
}
