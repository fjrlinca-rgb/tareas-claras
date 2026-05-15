import { RequireAuth } from "@/components/RequireAuth";
import Dashboard from "./Dashboard";

const Index = () => (
  <RequireAuth>
    <Dashboard />
  </RequireAuth>
);

export default Index;
