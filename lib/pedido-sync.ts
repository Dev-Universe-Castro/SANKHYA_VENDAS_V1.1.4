
import { db } from '@/lib/client-db';
import { toast } from 'sonner';

export interface PedidoPendenteDetalhado {
  id?: number;
  payload: any;
  synced: number;
  createdAt: number;
  tentativas: number;
  ultimaTentativa?: number;
  status: 'PENDENTE' | 'SINCRONIZANDO' | 'SUCESSO' | 'ERRO';
  erro?: string;
  nunotaGerado?: string;
  ambiente: 'OFFLINE' | 'ONLINE';
}

export const PedidoSyncService = {
  // 1. Tenta salvar online, se falhar, salva offline
  async salvarPedido(pedido: any) {
    const isOnline = navigator.onLine;
    
    if (isOnline) {
      try {
        // Tenta enviar para a API oficial
        const response = await fetch('/api/sankhya/pedidos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pedido)
        });

        const result = await response.json();

        if (!response.ok) {
          // Se for erro de validação (400), não salvar offline
          if (response.status === 400 || response.status === 422) {
            toast.error(result.error || 'Erro de validação no pedido');
            return { success: false, error: result.error };
          }
          
          throw new Error(result.error || "Erro API");
        }
        
        toast.success(`✅ Pedido ${result.nunota || result.NUNOTA || ''} criado com sucesso!`);
        return { success: true, data: result, ambiente: 'ONLINE' };

      } catch (error: any) {
        console.warn("Falha no envio online. Salvando offline...", error);
        // Cai no fallback offline para erros de conexão
      }
    }

    // FALLBACK OFFLINE
    return await this.salvarPedidoOffline(pedido);
  },

  // Salvar pedido na fila offline
  async salvarPedidoOffline(pedido: any) {
    try {
      const pedidoOffline: PedidoPendenteDetalhado = {
        payload: pedido,
        synced: 0,
        createdAt: Date.now(),
        tentativas: 0,
        status: 'PENDENTE',
        ambiente: 'OFFLINE'
      };

      const id = await db.pedidosPendentes.add(pedidoOffline);

      toast.info("🔌 Sem conexão. Pedido salvo na fila offline.");
      
      // Tenta disparar a sincronização em background caso a net volte rápido
      this.triggerBackgroundSync();
      
      return { success: true, offline: true, id, ambiente: 'OFFLINE' };
    } catch (err) {
      console.error("Erro crítico ao salvar offline", err);
      toast.error("❌ Erro ao salvar pedido no dispositivo.");
      return { success: false, error: String(err) };
    }
  },

  // 2. Processa a fila (Chamado ao recuperar conexão)
  async processarFila() {
    if (!navigator.onLine) {
      console.log('⚠️ Sem conexão. Fila não será processada.');
      return { processados: 0, sucesso: 0, erro: 0 };
    }

    const pendentes = await db.pedidosPendentes.where('synced').equals(0).toArray();
    if (pendentes.length === 0) {
      console.log('✅ Nenhum pedido pendente na fila');
      return { processados: 0, sucesso: 0, erro: 0 };
    }

    console.log(`🔄 Processando ${pendentes.length} pedidos pendentes...`);
    const loadingToast = toast.loading(`Sincronizando ${pendentes.length} pedidos pendentes...`);

    let successCount = 0;
    let errorCount = 0;

    for (const item of pendentes) {
      try {
        // Atualizar status para SINCRONIZANDO
        await db.pedidosPendentes.update(item.id!, {
          status: 'SINCRONIZANDO',
          tentativas: (item.tentativas || 0) + 1,
          ultimaTentativa: Date.now()
        });

        const response = await fetch('/api/sankhya/pedidos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload)
        });

        const result = await response.json();

        if (response.ok) {
          const nunota = result.nunota || result.NUNOTA || result.data?.nunota;
          
          // Registrar log via API
          try {
            const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
            await fetch('/api/admin/sync-logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                idEmpresa: user.ID_EMPRESA,
                userId: user.id,
                userName: user.name,
                tipoOperacao: 'PEDIDO',
                status: 'SUCESSO',
                dadosEnviados: item.payload,
                resposta: result,
                numeroDocumento: nunota?.toString()
              })
            });
          } catch (logError) {
            console.error('Erro ao registrar log:', logError);
          }
          
          // Atualizar status para SUCESSO e marcar como sincronizado
          await db.pedidosPendentes.update(item.id!, {
            synced: 1,
            status: 'SUCESSO',
            nunotaGerado: nunota?.toString(),
            ambiente: 'ONLINE'
          });
          
          successCount++;
        } else {
          const errorText = result.error || await response.text();
          
          // Registrar log de erro via API
          try {
            const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
            await fetch('/api/admin/sync-logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                idEmpresa: user.ID_EMPRESA,
                userId: user.id,
                userName: user.name,
                tipoOperacao: 'PEDIDO',
                status: 'ERRO',
                dadosEnviados: item.payload,
                erro: errorText
              })
            });
          } catch (logError) {
            console.error('Erro ao registrar log:', logError);
          }
          
          // Atualizar status para ERRO
          await db.pedidosPendentes.update(item.id!, {
            status: 'ERRO',
            erro: errorText
          });
          
          errorCount++;
        }
      } catch (e: any) {
        console.error("Erro ao sincronizar item", item.id, e);
        
        // Atualizar status para ERRO
        await db.pedidosPendentes.update(item.id!, {
          status: 'ERRO',
          erro: e.message || 'Erro desconhecido'
        });
        
        errorCount++;
      }
    }

    toast.dismiss(loadingToast);
    
    if (successCount > 0) {
      toast.success(`✅ ${successCount} pedidos sincronizados com sucesso!`);
    }
    
    if (errorCount > 0) {
      toast.error(`⚠️ ${errorCount} pedidos falharam na sincronização.`);
    }

    return { processados: pendentes.length, sucesso: successCount, erro: errorCount };
  },

  // Retentar pedidos com erro
  async retentarPedido(id: number) {
    try {
      const pedido = await db.pedidosPendentes.get(id);
      if (!pedido) {
        toast.error('Pedido não encontrado');
        return { success: false };
      }

      // Resetar status para PENDENTE
      await db.pedidosPendentes.update(id, {
        synced: 0,
        status: 'PENDENTE',
        erro: undefined
      });

      toast.info('Pedido adicionado de volta à fila');
      
      // Tentar processar imediatamente
      if (navigator.onLine) {
        await this.processarFila();
      }

      return { success: true };
    } catch (error) {
      console.error('Erro ao retentar pedido:', error);
      toast.error('Erro ao retentar pedido');
      return { success: false };
    }
  },

  // Remover pedido da fila
  async removerPedido(id: number) {
    try {
      await db.pedidosPendentes.delete(id);
      toast.success('Pedido removido da fila');
      return { success: true };
    } catch (error) {
      console.error('Erro ao remover pedido:', error);
      toast.error('Erro ao remover pedido');
      return { success: false };
    }
  },

  // Listener simples para tentar sincronizar quando voltar online
  triggerBackgroundSync() {
    if (typeof window !== 'undefined') {
      const handleOnline = () => {
        console.log('🌐 Conexão restaurada, processando fila de pedidos...');
        this.processarFila();
      };

      // Remove listener antigo se existir
      window.removeEventListener('online', handleOnline);
      
      // Adiciona novo listener
      window.addEventListener('online', handleOnline);
      
      // Tenta processar agora também (caso já esteja online)
      if (navigator.onLine) {
        setTimeout(() => this.processarFila(), 1000);
      }
    }
  },

  // Obter contagem de pedidos pendentes
  async getPendentesCount(): Promise<number> {
    try {
      return await db.pedidosPendentes.where('synced').equals(0).count();
    } catch (error) {
      console.error('Erro ao contar pedidos pendentes:', error);
      return 0;
    }
  },

  // Obter todos os pedidos pendentes com detalhes
  async getPedidosPendentes(): Promise<PedidoPendenteDetalhado[]> {
    try {
      return await db.pedidosPendentes.toArray();
    } catch (error) {
      console.error('Erro ao buscar pedidos pendentes:', error);
      return [];
    }
  },

  // Limpar pedidos sincronizados com sucesso
  async limparPedidosSincronizados() {
    try {
      const sincronizados = await db.pedidosPendentes
        .where('synced').equals(1)
        .and(p => p.status === 'SUCESSO')
        .toArray();
      
      for (const pedido of sincronizados) {
        await db.pedidosPendentes.delete(pedido.id!);
      }
      
      toast.success(`${sincronizados.length} pedidos sincronizados removidos`);
      return { success: true, count: sincronizados.length };
    } catch (error) {
      console.error('Erro ao limpar pedidos:', error);
      toast.error('Erro ao limpar pedidos');
      return { success: false, count: 0 };
    }
  }
};
