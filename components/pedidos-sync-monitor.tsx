
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PedidoSyncService, PedidoPendenteDetalhado } from "@/lib/pedido-sync"
import { RefreshCw, Trash2, CheckCircle, XCircle, Clock, Loader2, AlertCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function PedidosSyncMonitor() {
  const [pedidos, setPedidos] = useState<PedidoPendenteDetalhado[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [pedidoParaRemover, setPedidoParaRemover] = useState<number | null>(null)

  useEffect(() => {
    carregarPedidos()
    
    // Verificar status online
    setIsOnline(navigator.onLine)
    
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Atualizar a cada 5 segundos
    const interval = setInterval(carregarPedidos, 5000)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  const carregarPedidos = async () => {
    try {
      const pedidosPendentes = await PedidoSyncService.getPedidosPendentes()
      setPedidos(pedidosPendentes.sort((a, b) => b.createdAt - a.createdAt))
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSincronizar = async () => {
    if (!isOnline) {
      toast.error('⚠️ Sem conexão com a internet')
      return
    }

    setSyncing(true)
    try {
      await PedidoSyncService.processarFila()
      await carregarPedidos()
    } catch (error) {
      console.error('Erro ao sincronizar:', error)
      toast.error('Erro ao sincronizar pedidos')
    } finally {
      setSyncing(false)
    }
  }

  const handleRetentar = async (id: number) => {
    await PedidoSyncService.retentarPedido(id)
    await carregarPedidos()
  }

  const handleRemover = async () => {
    if (pedidoParaRemover === null) return
    
    await PedidoSyncService.removerPedido(pedidoParaRemover)
    await carregarPedidos()
    setPedidoParaRemover(null)
  }

  const handleLimparSincronizados = async () => {
    await PedidoSyncService.limparPedidosSincronizados()
    await carregarPedidos()
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDENTE':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>
      case 'SINCRONIZANDO':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Sincronizando</Badge>
      case 'SUCESSO':
        return <Badge variant="outline" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Sucesso</Badge>
      case 'ERRO':
        return <Badge variant="outline" className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getAmbienteBadge = (ambiente: string) => {
    return ambiente === 'OFFLINE' 
      ? <Badge variant="secondary">Offline</Badge>
      : <Badge variant="default">Online</Badge>
  }

  const pedidosPendentes = pedidos.filter(p => p.synced === 0)
  const pedidosSucesso = pedidos.filter(p => p.status === 'SUCESSO')
  const pedidosErro = pedidos.filter(p => p.status === 'ERRO')

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sincronização de Pedidos</CardTitle>
              <CardDescription>
                Acompanhe o status dos pedidos criados offline e online
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={carregarPedidos}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              {pedidosSucesso.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLimparSincronizados}
                >
                  Limpar Sincronizados
                </Button>
              )}
              {isOnline && pedidosPendentes.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleSincronizar}
                  disabled={syncing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {syncing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sincronizar Agora
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{pedidos.length}</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pendentes</p>
                    <p className="text-2xl font-bold text-yellow-600">{pedidosPendentes.length}</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Sucesso</p>
                    <p className="text-2xl font-bold text-green-600">{pedidosSucesso.length}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Erros</p>
                    <p className="text-2xl font-bold text-red-600">{pedidosErro.length}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status da Conexão */}
          <div className="mb-4 p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">
                {isOnline ? 'Online - Sincronização automática ativada' : 'Offline - Pedidos serão sincronizados quando houver conexão'}
              </span>
            </div>
          </div>

          {/* Tabela de Pedidos */}
          {pedidos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum pedido na fila de sincronização</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Ambiente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>NUNOTA</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidos.map((pedido) => (
                    <TableRow key={pedido.id}>
                      <TableCell className="text-xs">
                        {formatDistanceToNow(new Date(pedido.createdAt), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {pedido.payload?.RAZAO_SOCIAL || pedido.payload?.RAZAOSOCIAL || 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {pedido.payload?.CPF_CNPJ || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {pedido.payload?.itens?.length || 0}
                      </TableCell>
                      <TableCell>
                        R$ {pedido.payload?.VLRNOTA?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell>
                        {getAmbienteBadge(pedido.ambiente)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(pedido.status)}
                        {pedido.erro && (
                          <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={pedido.erro}>
                            {pedido.erro}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {pedido.nunotaGerado ? (
                          <Badge variant="outline" className="font-mono">
                            {pedido.nunotaGerado}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {pedido.tentativas || 0}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {pedido.status === 'ERRO' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetentar(pedido.id!)}
                              disabled={!isOnline}
                            >
                              <RefreshCw className="w-3 h-3" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPedidoParaRemover(pedido.id!)}
                          >
                            <Trash2 className="w-3 h-3 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação de remoção */}
      <AlertDialog open={pedidoParaRemover !== null} onOpenChange={() => setPedidoParaRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Remoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este pedido da fila de sincronização?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemover} className="bg-red-600 hover:bg-red-700">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
