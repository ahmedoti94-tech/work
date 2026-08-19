import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Layout, { NAV_ACCESS } from "./components/Layout";
import { ToastHost } from "./components/ui";
import { useStore } from "./lib/store";
import Dashboard from "./modules/Dashboard";
import Attendance from "./modules/Attendance";
import Payroll from "./modules/Payroll";
import Leaves from "./modules/Leaves";
import Marketplace from "./modules/Marketplace";
import Checkout from "./modules/Checkout";
import Orders from "./modules/Orders";
import Inventory from "./modules/Inventory";
import System from "./modules/System";

export default function App() {
  const view = useStore((s) => s.view);
  const user = useStore((s) => s.user);
  const setView = useStore((s) => s.setView);
  const setOnline = useStore((s) => s.setOnline);

  // مراقبة حالة الاتصال — مزامنة تلقائية عند العودة
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [setOnline]);

  // حماية المسارات: إذا تبدّل الدور ولا تملك صلاحية الصفحة الحالية
  useEffect(() => {
    if (!NAV_ACCESS[view].includes(user.role)) setView("dashboard");
  }, [user.role, view, setView]);

  const pages = {
    dashboard: <Dashboard />,
    attendance: <Attendance />,
    payroll: <Payroll />,
    leaves: <Leaves />,
    marketplace: <Marketplace />,
    orders: <Orders />,
    inventory: <Inventory />,
    system: <System />,
  };

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.24, ease: [0.2, 0.7, 0.2, 1] }}
        >
          {pages[view]}
        </motion.div>
      </AnimatePresence>
      <Checkout />
      <ToastHost />
    </Layout>
  );
}
