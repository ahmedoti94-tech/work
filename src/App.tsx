import Layout from "./components/Layout";
import { ToastHost } from "./components/ui";
import { NAV_ACCESS, useStore } from "./lib/store";
import Dashboard from "./modules/Dashboard";
import Marketplace from "./modules/Marketplace";
import Orders from "./modules/Orders";
import Attendance from "./modules/Attendance";
import Payroll from "./modules/Payroll";
import Leaves from "./modules/Leaves";
import Inventory from "./modules/Inventory";
import System from "./modules/System";
import Checkout from "./modules/Checkout";

export default function App() {
  const view = useStore((s) => s.view);
  const role = useStore((s) => s.user.role);
  const effective = NAV_ACCESS[view].includes(role) ? view : "dashboard";

  return (
    <>
      <Layout>
        {effective === "dashboard" && <Dashboard />}
        {effective === "market" && <Marketplace />}
        {effective === "orders" && <Orders />}
        {effective === "attendance" && <Attendance />}
        {effective === "payroll" && <Payroll />}
        {effective === "leaves" && <Leaves />}
        {effective === "inventory" && <Inventory />}
        {effective === "system" && <System />}
      </Layout>
      <Checkout />
      <ToastHost />
    </>
  );
}
