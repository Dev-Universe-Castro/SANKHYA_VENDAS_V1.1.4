
import DashboardLayout from "@/components/dashboard-layout"
import PedidosTable from "@/components/pedidos-table"

export default function PedidosPage() {
  return (
    <DashboardLayout hideFloatingMenu={true}>
      <PedidosTable />
    </DashboardLayout>
  )
}
